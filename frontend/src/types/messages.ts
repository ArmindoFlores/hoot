import { PlayerTrack, RepeatMode } from "./tracks";

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
    type: "fade";
    payload: FadeMessagePayload;
} | {
    type: "play";
    payload: PlayMessagePayload;
} | {
    type: "playing";
    payload: PlayingMessagePayload;
} | {
    type: "hello";
    payload: undefined;
};
