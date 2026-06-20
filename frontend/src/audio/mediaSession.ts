import { AudioHandler } from "./audioHandler";

function defaultMetadata() {
    return new MediaMetadata({
        album: "Hoot",
        artwork: [{ src: "/hoot.webp", sizes: "1024x1024", type: "image/webp" }]
    });
}

export function setupMediaSession() {
    navigator.mediaSession.metadata = defaultMetadata();
    navigator.mediaSession.playbackState = "paused";
}

export function updateMediaSession(audioHandler: AudioHandler) {
    const mediaSession = navigator.mediaSession;
    const metadata = navigator.mediaSession.metadata ?? defaultMetadata();
    const playingPlaylists = Object.entries(audioHandler.playing).filter(kv => kv[1].playing);

    metadata.title = playingPlaylists.map(kv => kv[1].currentTrack.name).join(" / ");
    metadata.artist = playingPlaylists.map(kv => kv[0]).join(" / ");
    mediaSession.playbackState = playingPlaylists.length > 0 ? "playing" : "paused";
    mediaSession.metadata = metadata;
}
