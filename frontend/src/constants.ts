import { id } from "./utils";

export const constants = {
    AUDIO_CONTROLLER_MESSAGE_CHANNEL_ID: id("audio-controller"),
    EXTERNAL_AUDIO_CONTROLLER_MESSAGE_CHANNEL_ID: id("external", "audio-controller"),
    AUDIO_CONTROLLER_CLIENT_MESSAGE_CHANNEL_ID: id("audio-controller", "client"),
    EXTERNAL_AUDIO_CONTROLLER_CLIENT_MESSAGE_CHANNEL_ID: id("external", "audio-controller", "client"),
    MODAL_HEARTBEAT_MESSAGE_CHANNEL_ID: id("modal-heartbeat"),
    ASYNC_UPDATES_MESSAGE_CHANNEL_ID: id("async-updates"),
    MODAL_HEARTBEAT_DELAY: 1000,
};
