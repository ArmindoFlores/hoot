import { RepeatMode, SimpleTrack, Track } from "./tracks";

export interface FadeObject {
    playlist: string;
    fade: "in" | "out";
    duration: number;
}

export interface PlayMessagePayload {
    playlist: string;
    track: string;
    repeatMode?: RepeatMode;
    shuffle?: boolean;
    volume?: number;
}

export type MessageContent = {
    type: "get-track";
    payload: string;
} | {
    type: "get-playlists";
} | {
    type: "track";
    payload: SimpleTrack;
} | {
    type: "playlists";
    payload: string[];
} | {
    type: "fade";
    payload: FadeObject;
} | {
    type: "add-track";
    payload: Track & { file?: File };
} | {
    type: "play";
    payload: PlayMessagePayload;
};
