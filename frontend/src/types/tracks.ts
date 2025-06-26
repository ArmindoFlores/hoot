export type RepeatMode = "no-repeat" | "repeat-all" | "repeat-self";

export interface PlayerTrack {
    playlist: string;
    name: string;
    source: string;
    playing: boolean;
    position: number;
    volume: number;
}

export interface Track {
    id: number;
    name: string;
    playlists?: string[];
    source: string|null;
    source_expiration: number|null;
    size: number;
}
