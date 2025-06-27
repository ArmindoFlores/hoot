import { PlayerTrack, RepeatMode, Track } from "./tracks";

export type FadeType = "in" | "out";

export interface FadeMessagePayload {
    playlist: string;
    fade: FadeType;
    duration: number;
}

export interface PlayMessagePayload {
    playlist: string;
    track: string;
    repeatMode?: RepeatMode;
    shuffle?: boolean;
    volume?: number;
}

export interface PlayingMessagePayload {
    playing: PlayerTrack[];
}

export type MessageContent = {
    type: "get-track";
    payload: string;
} | {
    type: "get-playlists";
} | {
    type: "track";
    payload: PlayerTrack;
} | {
    type: "playlists";
    payload: string[];
} | {
    type: "fade";
    payload: FadeMessagePayload;
} | {
    type: "add-track";
    payload: Track & { file?: File };
} | {
    type: "play";
    payload: PlayMessagePayload;
} | {
    type: "playing";
    payload: PlayingMessagePayload;
};
