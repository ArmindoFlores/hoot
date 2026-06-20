import { HootAudioInfoMessage, HootFadeMessage, HootGetAudioInfoMessage, HootGetGlobalInfoMessage, HootGetPlayingInfoMessage, HootGlobalInfoMessage, HootNextTrackMessage, HootPauseMessage, HootPlayAudioMessage, HootPlayMessage, HootPlayingInfoMessage, HootPreviousTrackMessage, HootReloadTracksMessage, HootSeekMessage, HootSetGlobalVolumeMessage, HootSetRepeatModeMessage, HootSetShuffleMessage, HootSetVolumeMessage, HootSuccessResponse, HootUnloadMessage } from "./messages";

export type HootAudioControlsMessageRegistry = {
    HOOT_PLAY_AUDIO: {
        request: HootPlayAudioMessage;
        response: HootSuccessResponse;
    };
    HOOT_PLAY: {
        request: HootPlayMessage;
        response: HootSuccessResponse;
    };
    HOOT_GET_AUDIO_INFO: {
        request: HootGetAudioInfoMessage;
        response: HootAudioInfoMessage;
    };
    HOOT_GET_PLAYING_INFO: {
        request: HootGetPlayingInfoMessage;
        response: HootPlayingInfoMessage;
    };
    HOOT_PAUSE: {
        request: HootPauseMessage;
        response: HootSuccessResponse;
    };
    HOOT_NEXT_TRACK: {
        request: HootNextTrackMessage;
        response: HootSuccessResponse;
    };
    HOOT_PREVIOUS_TRACK: {
        request: HootPreviousTrackMessage;
        response: HootSuccessResponse;
    };
    HOOT_RELOAD_TRACKS: {
        request: HootReloadTracksMessage;
        response: HootSuccessResponse;
    };
    HOOT_GET_GLOBAL_INFO: {
        request: HootGetGlobalInfoMessage;
        response: HootGlobalInfoMessage;
    };
    HOOT_SET_GLOBAL_VOLUME: {
        request: HootSetGlobalVolumeMessage;
        response: HootSuccessResponse;
    };
    HOOT_SET_VOLUME: {
        request: HootSetVolumeMessage;
        response: HootSuccessResponse;
    };
    HOOT_SET_REPEAT_MODE: {
        request: HootSetRepeatModeMessage;
        response: HootSuccessResponse;
    };
    HOOT_SET_SHUFFLE: {
        request: HootSetShuffleMessage;
        response: HootSuccessResponse;
    };
    HOOT_SEEK: {
        request: HootSeekMessage;
        response: HootSuccessResponse;
    };
    HOOT_UNLOAD: {
        request: HootUnloadMessage;
        response: HootSuccessResponse;
    };
    HOOT_FADE: {
        request: HootFadeMessage;
        response: HootSuccessResponse;
    };
};
