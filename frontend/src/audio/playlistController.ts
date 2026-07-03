import { RepeatMode, Track } from "../types/tracks";

import { AudioHandler } from "./audioHandler";
import { TrackLibrary } from "./tracks";
import { shuffle as ldShuffle } from "lodash";
import { logging } from "../logging";
import { mod } from "../utils";

export class PlaylistController {
    playlist: string | null;
    tracks: number[] = [];
    shuffledTracks: number[] = [];
    repeat: RepeatMode;
    
    protected $audioHandler: AudioHandler;
    protected $library: TrackLibrary | undefined;
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

    constructor(audioHandler: AudioHandler, library: TrackLibrary | undefined, playlist: string | null, shuffle: boolean = false, repeat: RepeatMode = "no-repeat") {
        this.$audioHandler = audioHandler;
        this.playlist = playlist;
        this.$library = library;
        this.$customTrackMapping = new Map();
        this.updateTrackList();
        this.$gain = audioHandler.createGain();
        this.$gain.gain.setValueAtTime(1, 0);
        this.$audio = new Audio();
        this.$source = audioHandler.createSource(this.$audio);
        this.$audio.crossOrigin = "anonymous";
        this.$audioHandler.connect(this.$source.connect(this.$gain));
        this.$shuffle = shuffle;
        this.repeat = repeat;
    }

    protected $getTrackFromID(id: number) {
        if (this.$customTrackMapping.has(id)) {
            return this.$customTrackMapping.get(id)!;
        }
        return this.$library?.getTrack?.(id);
    }

    async getLoadedTrackFromID(id: number) {
        if (this.$customTrackMapping.has(id)) {
            return this.$customTrackMapping.get(id) as Omit<Track, "source"> & { source: string };
        }
        if (this.$library === undefined) {
            throw new Error(`tried to load a non-existing track with ID ${id}`);
        }
        return await this.$library.getLoadedTrack(id);
    }

    unload() {
        this.$gain.disconnect();
        this.$source.disconnect();
    }

    protected async $load(id: number, playOnLoad: boolean = false) {
        const track = await this.getLoadedTrackFromID(id);

        await this.$audioHandler.resume();
        this.$gain = this.$audioHandler.createGain();
        this.$gain.gain.setValueAtTime(this.$volume, 0);
        
        this.$audio = new Audio(track.source);
        this.$audio.addEventListener("error", () => this.$onError(), { once: true });
        this.$audio.addEventListener("canplaythrough", () => this.$onLoad(), { once: true });
        this.$audio.addEventListener("ended", () => this.$onEnd(), { once: true });
        
        this.$source = this.$audioHandler.createSource(this.$audio);
        this.$audioHandler.connect(this.$source.connect(this.$gain));
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
            this.unload();
            return;
        }
        await this.nextTrack(false, true);
    }

    addCustomTrack(track: Track) {
        this.$customTrackMapping.set(track.id, track);
    }

    updateTrackList() {
        this.tracks = this.playlist ? this.$library?.getPlaylistTrackIDs?.(this.playlist) ?? [] : [];
        this.shuffledTracks = ldShuffle(this.tracks);
    }

    async playTrack(id: number, playOnLoad: boolean) {
        if (this.playlist) {
            const index = this.tracks.findIndex(trackId => trackId === id);
            if (index === -1) {
                throw new Error(`the track with ID "${id}" was not found`);
            }
            this.$trackIndex = index;
            this.unload();
            await this.$load(id, playOnLoad);
        }
        else {
            this.$trackIndex = 0;
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
                const now = this.$audioHandler.currentTime;
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
                const now = this.$audioHandler.currentTime;
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
        this.unload();
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
        this.unload();
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
        this.$gain.gain.setValueAtTime(v, this.$audioHandler.currentTime);
    }

    get currentTrackId() {
        return (this.shuffle ? this.shuffledTracks : this.tracks)[this.$trackIndex];
    }

    get currentTrack() {
        const trackId = this.currentTrackId;
        const track = this.$getTrackFromID(trackId);
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
