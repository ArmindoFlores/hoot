import { HootFadeMessage, HootPlayingInfoMessage, HootPlaylistAudioInfoMessage, HootSuccessResponse } from "./messages";

export type HootAsyncUpdatesMessageRegistry = {
    HOOT_PLAYING_INFO: {
        request: HootPlayingInfoMessage;
        response: HootSuccessResponse;
    };
    HOOT_AUDIO_INFO: {
        request: HootPlaylistAudioInfoMessage;
        response: HootSuccessResponse;
    };
    HOOT_FADE: {
        request: HootFadeMessage;
        response: HootSuccessResponse;
    };
}
