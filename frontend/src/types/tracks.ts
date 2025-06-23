export type RepeatMode = "no-repeat" | "repeat-all" | "repeat-self";

export interface SimpleTrack {
    playlist: string;
    name: string;
    source: string;
    time: number;
    volume: number;
    playing: boolean;
}

export interface Track {
    id: number;
    name: string;
    playlists?: string[];
    source: string|null;
    source_expiration: number|null;
    size: number;
}
