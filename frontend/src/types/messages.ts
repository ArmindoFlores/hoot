import { RepeatMode } from "../components/AudioPlayerProvider";
import { SimpleTrack } from "./tracks";
import { Track } from "../components/TrackProvider";

export interface FadeObject {
    playlist: string;
    fade: "in" | "out";
    duration: number;
}

export interface PlayMessagePayload {
    playlist: string;
    track: number;
    repeatMode?: RepeatMode;
    shuffle?: boolean;
    volume?: number;
}

export type MessageContent = {
    type: "get-track";
    payload: string;
} | {
    type: "get-playlists";
    payload: never;
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
