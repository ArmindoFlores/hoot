export interface MessageContent {
    type: "get-track" | "get-playlists" | "track" | "playlists" | "fade" | "add-track";
    payload: unknown;
}
