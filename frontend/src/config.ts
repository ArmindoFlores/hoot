export const ENDPOINT = import.meta.env.VITE_ENDPOINT;
export const PATREON_CLIENT_ID = import.meta.env.VITE_PATREON_CLIENT_ID;
export const PATREON_REDIRECT_URI = `${ENDPOINT}/auth/oauth/redirect`;
export const REVERSE_DOMAIN = "eu.armindo";
export const APP_KEY = `${REVERSE_DOMAIN}.hoot`;
export const INTERNAL_BROADCAST_CHANNEL = `${APP_KEY}/internal`;
export const EXTERNAL_BROADCAST_CHANNEL = `${APP_KEY}/external`;

export const STORAGE_KEYS = {
    TRACKS: "tracks",
    FADE_DURATION: "settings-fade-duration",
    STOP_OTHER_TRACKS: "settings-stop-other-tracks",
    ENABLE_AUTOPLAY: "settings-enable-autoplay",
    PLAYLIST_VOLUME: "playlist-volume-",
};
