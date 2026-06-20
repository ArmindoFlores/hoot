import { RepeatMode, Track } from "../types/tracks";

import { TrackLibrary } from "./tracks";
import { shuffle as ldShuffle } from "lodash";
import { logging } from "../logging";
import { mod } from "../utils";

export class PlaylistController {
    playlist: string | null;
    tracks: number[] = [];
    shuffledTracks: number[] = [];
    repeat: RepeatMode;
    
    protected $ctx: AudioContext;
    protected $globalGain: GainNode;
    protected $library: TrackLibrary;
    protected $customTrackMapping: Map<number, Track>;
    protected $audio: HTMLAudioElement;
    protected $gain: GainNode;
    protected $source: MediaElementAudioSourceNode;
    protected $volume = 1;
    protected $fading = false;
    protected $shuffle: boolean;
    protected $loaded = false;
    protected $trackIndex = -1;
    protected $playOnLoad = false;
    protected $onEndCallbacks: (() => void)[] = [];
    protected $onLoadCallbacks: (() => void)[] = [];
    protected $onErrorCallbacks: ((e: MediaError) => void)[] = [];

    constructor(ctx: AudioContext, globalGain: GainNode, library: TrackLibrary, playlist: string | null, shuffle: boolean = false, repeat: RepeatMode = "no-repeat") {
        this.$ctx = ctx;
        this.$globalGain = globalGain;
        this.playlist = playlist;
        this.$library = library;
        this.$customTrackMapping = new Map();
        this.updateTrackList();
        this.$gain = ctx.createGain();
        this.$gain.gain.setValueAtTime(1, 0);
        this.$audio = new Audio();
        this.$source = ctx.createMediaElementSource(this.$audio);
        this.$audio.crossOrigin = "anonymous";
        this.$source.connect(this.$gain).connect(globalGain);
        this.$shuffle = shuffle;
        this.repeat = repeat;
    }

    protected $getTrackFromID(id: number) {
        if (this.$customTrackMapping.has(id)) {
            return this.$customTrackMapping.get(id)!;
        }
        return this.$library.getTrack(id);
    }

    protected async $getLoadedTrackFromID(id: number) {
        if (this.$customTrackMapping.has(id)) {
            return this.$customTrackMapping.get(id) as Omit<Track, "source"> & { source: string };
        }
        return await this.$library.getLoadedTrack(id);
    }

      protected $unload() {
        this.$gain.disconnect();
        this.$source.disconnect();
    }

    protected async $load(id: number, playOnLoad: boolean = false) {
        const track = await this.$getLoadedTrackFromID(id);

        this.$ctx.resume();
        this.$gain = this.$ctx.createGain();
        this.$gain.gain.setValueAtTime(this.$volume, 0);
        
        this.$audio = new Audio(track.source);
        this.$audio.addEventListener("error", () => this.$onError(), { once: true });
        this.$audio.addEventListener("canplaythrough", () => this.$onLoad(), { once: true });
        this.$audio.addEventListener("ended", () => this.$onEnd(), { once: true });
        
        this.$source = this.$ctx.createMediaElementSource(this.$audio);
        this.$source.connect(this.$gain).connect(this.$globalGain);
        this.$audio.crossOrigin = "anonymous";
        this.$audio.preload = "auto";
        this.$audio.load();
        this.$loaded = false;
        this.$playOnLoad = playOnLoad;
    }

    protected $isLastTrack() {
        return this.$trackIndex === this.tracks.length - 1;
    }

    protected $nextTrackIndex(ignoreRepeat: boolean = false) {
        const repeatSelf = !ignoreRepeat && this.repeat === "repeat-self";
        return repeatSelf ? this.$trackIndex : mod(this.$trackIndex + 1, this.tracks.length);
    }

    protected $previousTrackIndex() {
        return mod(this.$trackIndex - 1, this.tracks.length);
    }

    protected $onError() {
        logging.error(`(playlist "${this.playlist}")`, this.$audio.error);
        for (const cb of this.$onErrorCallbacks) {
            try {
                cb(this.$audio.error!);
            }
            catch (error) {
                logging.error(`(playlist "${this.playlist}") error on onError callback:`, error);
            }
        }
    }

    protected $onLoad() {
        this.$loaded = true;
        if (this.$playOnLoad) {
            this.play();
        }
        for (const cb of this.$onLoadCallbacks) {
            try {
                cb();
            }
            catch (error) {
                logging.error(`(playlist "${this.playlist}") error on onLoad callback:`, error);
            }
        }
    }

    protected async $onEnd() {
        for (const cb of this.$onEndCallbacks) {
            try {
                cb();
            }
            catch (error) {
                logging.error(`(playlist "${this.playlist}") error on onEnd callback:`, error);
            }
        }
        if (this.$isLastTrack() && this.repeat === "no-repeat") {
            this.$unload();
            return;
        }
        await this.nextTrack(false, true);
    }

    addCustomTrack(track: Track) {
        this.$customTrackMapping.set(track.id, track);
    }

    updateTrackList() {
        this.tracks = this.playlist ? this.$library.getPlaylistTrackIDs(this.playlist) ?? [] : [];
        this.shuffledTracks = ldShuffle(this.tracks);
    }

    async playTrack(id: number, playOnLoad: boolean) {
        logging.info(`called .playTrack() with playOnLoad=${playOnLoad}`);
        if (this.playlist) {
            const index = this.tracks.findIndex(trackId => trackId === id);
            if (index === -1) {
                throw new Error(`the track with ID "${id}" was not found`);
            }
            this.$trackIndex = index;
            this.$unload();
            await this.$load(id, playOnLoad);
        }
        else {
            this.tracks = [id];
            this.shuffledTracks = [id];
            await this.$load(id, playOnLoad);
        }
    }

    async play() {
        if (!this.$loaded) {
            throw new Error(`(playlist "${this.playlist}"): tried to play an unloaded track`);
        }
        await this.$audio.play();
    }

    pause() {
        if (!this.$loaded) {
            throw new Error(`(playlist "${this.playlist}"): tried to pause an unloaded track`);
        }
        this.$audio.pause();
    }

    async fadeIn(duration: number) {
        this.$fading = true;
        try {
            await this.play();
            return new Promise(resolve => {
                const gain = this.$gain.gain;
                const now = this.$ctx.currentTime;
                gain.cancelScheduledValues(now);
                gain.setValueAtTime(0, now);
                gain.linearRampToValueAtTime(this.$volume, now + duration / 1000);
                setTimeout(resolve, duration);
            });
        }
        finally {
            this.$fading = false;
        }
    }

    async fadeOut(duration: number) {
        this.$fading = true;
        try {
            await new Promise(resolve => {
                const gain = this.$gain.gain;
                const now = this.$ctx.currentTime;
                gain.cancelScheduledValues(now);
                gain.setValueAtTime(gain.value, now);
                gain.linearRampToValueAtTime(0, now + duration / 1000);
                setTimeout(resolve, duration);
            });
            this.pause();
        }
        finally {
            this.$fading = false;
        }
    }

    async nextTrack(ignoreRepeat?: boolean, playOnLoad?: boolean) {
        const wasPlaying = this.playing;
        if (this.$loaded) {
            this.pause();
        }
        this.$unload();
        const nextTrackIndex = this.$nextTrackIndex(ignoreRepeat);
        this.$trackIndex = nextTrackIndex;
        const nextTrack = this.shuffle ? this.shuffledTracks[nextTrackIndex] : this.tracks[nextTrackIndex];
        await this.$load(nextTrack, playOnLoad ?? wasPlaying);
    }

    async previousTrack(playOnLoad?: boolean) {
        const wasPlaying = this.playing;
        if (this.$loaded) {
            this.pause();
        }
        this.$unload();
        const previousTrackIndex = this.$previousTrackIndex();
        this.$trackIndex = previousTrackIndex;
        const previousTrack = this.shuffle ? this.shuffledTracks[previousTrackIndex] : this.tracks[previousTrackIndex];
        await this.$load(previousTrack, playOnLoad ?? wasPlaying);
    }

    addOnEndHandler(callback: () => void) {
        this.$onEndCallbacks.push(callback);
    }

    addOnLoadHandler(callback: () => void) {
        this.$onLoadCallbacks.push(callback);
    }

    addOnErrorHandler(callback: (e: MediaError) => void) {
        this.$onErrorCallbacks.push(callback);
    }

    get playing() {
        return !this.$audio.paused;
    }

    get shuffle() {
        return this.$shuffle;
    }

    set shuffle(value: boolean) {
        const currentTrackId = this.currentTrackId;
        const trackList = value ? this.shuffledTracks : this.tracks;
        this.$trackIndex = trackList.findIndex(t => t === currentTrackId);
        this.$shuffle = value;
    }

    get fading() {
        return this.$fading;
    }

    get loaded() {
        return this.$loaded;
    }

    get volume() {
        return this.$volume;
    }

    set volume(v: number) {
        this.$volume = v;
        this.$gain.gain.setValueAtTime(v, this.$ctx.currentTime);
    }

    get currentTrackId() {
        return (this.shuffle ? this.shuffledTracks : this.tracks)[this.$trackIndex];
    }

    get currentTrack() {
        const trackId = this.currentTrackId;
        const track = this.$library.getTrack(trackId);
        if (track === undefined) {
            throw new Error(`found invalid track ID ${trackId}`);
        }
        return track;
    }

    get currentTrackDuration() {
        return this.$audio.duration;
    }

    get currentTrackPosition() {
        return this.$audio.currentTime;
    }

    set currentTrackPosition(position: number) {
        this.$audio.currentTime = position;
    }
}
