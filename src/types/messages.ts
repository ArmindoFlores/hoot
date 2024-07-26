export interface MessageContent {
    type: "get-track" | "get-playlists" | "track" | "playlists";
    payload: unknown;
}
