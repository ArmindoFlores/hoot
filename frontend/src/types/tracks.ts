export interface SimpleTrack {
    playlist: string;
    name: string;
    source: string;
    time: number;
    volume: number;
    playing: boolean;
}

export interface OnlineTrack {
    id: number;
    name: string;
    playlists?: string[];
    source?: string;
    source_expiration?: number;
    size: number;
}
