import { PlaylistController } from "./playlistController";
import { Track } from "../types/tracks";
import { TrackLibrary } from "./tracks";

export class AudioHandler {
    playing: Record<string, PlaylistController> = {};
    
    protected $ctx!: AudioContext;
    protected $gain!: GainNode;

    constructor() {
        this.reset();
    }

    async playTrack(track: Track | number, playlist: string | null, library?: TrackLibrary, playOnLoad?: boolean): Promise<PlaylistController> {
        const isCustomTrack = typeof track === "object";
        const isStandalone = playlist === null;
        const trackId = isCustomTrack ? track.id : track;
        const alreadyPlaying = (playlist === null || this.playing[playlist] === undefined) ? false : this.playing[playlist].playing;
        const pc = !isStandalone && this.playing[playlist] ? this.playing[playlist] : new PlaylistController(this, library, playlist);
        if (playlist !== null) {
            this.playing[playlist] = pc;
        }
        if (isCustomTrack) {
            pc.addCustomTrack(track);
        }
        await pc.playTrack(trackId, alreadyPlaying ? true : playOnLoad ?? false);
        return pc;
    }

    reset() {
        this.$ctx = new AudioContext();
        this.$gain = this.$ctx.createGain();
        this.$gain.gain.setValueAtTime(1, 0);
        this.$gain.connect(this.$ctx.destination);
        this.$ctx.resume();
    }

    set volume(volume: number) {
        this.$gain.gain.setValueAtTime(volume, this.$ctx.currentTime);
    }

    get volume() {
        return this.$gain.gain.value;
    }

    get currentTime() {
        return this.$ctx.currentTime;
    }

    async resume() {
        await this.$ctx.resume();
    }

    get state() {
        return this.$ctx.state;
    }

    connect(node: AudioNode) {
        return node.connect(this.$gain);
    }

    createGain(): GainNode {
        return this.$ctx.createGain();
    }

    createSource(mediaElement: HTMLMediaElement): MediaElementAudioSourceNode {
        return this.$ctx.createMediaElementSource(mediaElement);
    }

    closePlaylist(playlist: string) {
        this.playing[playlist].pause();
        this.playing[playlist].unload();
        delete this.playing[playlist];
    }
}
