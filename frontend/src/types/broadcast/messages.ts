import { RepeatMode, Track } from "../tracks";

import { MessageBase } from "@armindoflores/obr-ext-core/types";

export interface HootPlayAudioMessage extends MessageBase {
    type: "HOOT_PLAY_AUDIO";
    track: Track | number;
    playlist?: string;
    waitForFinish?: boolean;
    playOnLoad?: boolean;
}

export interface HootSuccessResponse extends MessageBase {
    type: "HOOT_SUCCESS";
}

export interface HootPlayMessage extends MessageBase {
    type: "HOOT_PLAY";
    playlist: string;
}

export interface HootPauseMessage extends MessageBase {
    type: "HOOT_PAUSE";
    playlist: string;
}

export interface HootSetVolumeMessage extends MessageBase {
    type: "HOOT_SET_VOLUME";
    playlist: string;
    volume: number;
}

export interface HootSetRepeatModeMessage extends MessageBase {
    type: "HOOT_SET_REPEAT_MODE";
    playlist: string;
    repeat: RepeatMode;
}

export interface HootSetShuffleMessage extends MessageBase {
    type: "HOOT_SET_SHUFFLE";
    playlist: string;
    shuffle: boolean;
}

export interface HootSeekMessage extends MessageBase {
    type: "HOOT_SEEK";
    playlist: string;
    position: number;
}

export interface HootUnloadMessage extends MessageBase {
    type: "HOOT_UNLOAD";
    playlist: string;
}

export interface HootNextTrackMessage extends MessageBase {
    type: "HOOT_NEXT_TRACK";
    playlist: string;
}

export interface HootPreviousTrackMessage extends MessageBase {
    type: "HOOT_PREVIOUS_TRACK";
    playlist: string;
}

export interface HootGetAudioInfoMessage extends MessageBase {
    type: "HOOT_GET_AUDIO_INFO";
    playlist: string;
}

export interface HootAudioInfo {
    title: string;
    duration: number;
    position: number;
    shuffle: boolean;
    repeat: RepeatMode;
    volume: number;
    playing: boolean;
}

export interface HootPlayingInfo {
    title: string;
    source: string | null;
    trackId: number;
    duration: number;
    position: number;
    shuffle: boolean;
    repeat: RepeatMode;
}

export interface HootAudioInfoMessage extends MessageBase, HootAudioInfo {
    type: "HOOT_AUDIO_INFO";
}

export interface HootPlaylistAudioInfo extends HootAudioInfo {
    source: string;
    trackId: number;
    playlist: string;
}

export interface HootPlaylistAudioInfoMessage extends MessageBase, HootPlaylistAudioInfo {
    type: "HOOT_AUDIO_INFO";
}

export interface HootGetPlayingInfoMessage extends MessageBase {
    type: "HOOT_GET_PLAYING_INFO";
}

export interface HootPlayingInfoMessage extends MessageBase {
    type: "HOOT_PLAYING_INFO";
    playing: Record<string, HootPlayingInfo>;
}

export interface HootGetFullInfoMessage extends MessageBase {
    type: "HOOT_GET_FULL_INFO";
}

export interface HootFullInfoMessage extends MessageBase {
    type: "HOOT_FULL_INFO";
    playing: Record<string, HootPlaylistAudioInfo>;
}

export interface HootReloadTracksMessage extends MessageBase {
    type: "HOOT_RELOAD_TRACKS";
}

export interface HootGetGlobalInfoMessage extends MessageBase {
    type: "HOOT_GET_GLOBAL_INFO";
}

export interface HootGlobalInfoMessage extends MessageBase {
    type: "HOOT_GLOBAL_INFO";
    volume: number;
}

export interface HootSetGlobalVolumeMessage extends MessageBase {
    type: "HOOT_SET_GLOBAL_VOLUME";
    volume: number;
}

export interface HootFadeMessage extends MessageBase {
    type: "HOOT_FADE";
    playlist: string;
    fade: "in" | "out";
    duration: number;
}
