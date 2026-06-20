import { APIHandler, ClientAPI } from "@armindoflores/obr-ext-core";
import { HootFadeMessage, HootGetAudioInfoMessage, HootNextTrackMessage, HootPauseMessage, HootPlayAudioMessage, HootPlayMessage, HootPreviousTrackMessage, HootReloadTracksMessage, HootSeekMessage, HootSetGlobalVolumeMessage, HootSetRepeatModeMessage, HootSetShuffleMessage, HootSetVolumeMessage, HootUnloadMessage } from "../types/broadcast/messages";
import { setupMediaSession, updateMediaSession } from "./mediaSession";

import { AudioHandler } from "./audioHandler";
import { HootAsyncUpdatesMessageRegistry } from "../types/broadcast/asyncUpdates";
import { HootAudioControlsMessageRegistry } from "../types/broadcast/audioControls";
import OBR from "@owlbear-rodeo/sdk";
import { TrackLibrary } from "./tracks";
import { constants } from "../constants";
import { logging } from "../logging";
import { makeErrorMessage } from "@armindoflores/obr-ext-core/utils";

const asyncUpdatesClient = new ClientAPI<HootAsyncUpdatesMessageRegistry>(
    constants.ASYNC_UPDATES_MESSAGE_CHANNEL_ID,
    constants.ASYNC_UPDATES_MESSAGE_CHANNEL_ID,
    "ALL"
);
const library = new TrackLibrary();
const audioHandler = new AudioHandler();

function reportPlaylistChange() {
    asyncUpdatesClient.send<"HOOT_PLAYING_INFO">(
        {
            type: "HOOT_PLAYING_INFO",
            playing: Object.fromEntries(Object.entries(audioHandler.playing).map(([k, v]) => [
                k,
                {
                    title: v.currentTrack.name,
                    source: v.currentTrack.source,
                    id: v.currentTrack.id,
                    duration: v.currentTrackDuration,
                    position: v.currentTrackPosition,
                    shuffle: v.shuffle,
                    repeat: v.repeat,
                }
            ]))
        }
    );
}

async function reportTrackChange(playlist: string) {
    const pc = audioHandler.playing[playlist];
    if (pc === undefined || pc.currentTrack === undefined) {
        reportPlaylistChange();
        return;
    }
    const trackId = pc.currentTrackId;
    asyncUpdatesClient.send<"HOOT_AUDIO_INFO">(
        {
            type: "HOOT_AUDIO_INFO",
            trackId,
            source: (await pc.getLoadedTrackFromID(trackId)).source,
            title: pc.currentTrack.name,
            duration: pc.currentTrackDuration,
            position: pc.currentTrackPosition,
            shuffle: pc.shuffle,
            repeat: pc.repeat,
            volume: pc.volume,
            playing: pc.playing,
            playlist
        }
    );
}

function reportFadeStarted(message: HootFadeMessage) {
    asyncUpdatesClient.send<"HOOT_FADE">(message);
}

function setupModalListener() {
    // Whenever a user opens the Manage Tracks modal, a timeout is registered here.
    // If the listener does not receive a heartbeat within a timeout, it is assumed
    // that the modal has been closed, and tracks are reloaded.
    const activeModals = new Map<string, number>();

    OBR.broadcast.onMessage(constants.MODAL_HEARTBEAT_MESSAGE_CHANNEL_ID, message => {
        const id = (message.data as {id?: string}).id;
        if (!id) {
            return;
        }
        if (activeModals.has(id)) {
            clearTimeout(activeModals.get(id));
        }
        activeModals.set(id, window.setTimeout(() => {
            activeModals.delete(id);
            library.fetch();
        }, Math.round(constants.MODAL_HEARTBEAT_DELAY * 1.25)));
    }, );
}

function setupAudioControlsAPIHandler() {
    const handler = new APIHandler<HootAudioControlsMessageRegistry>(
        constants.AUDIO_CONTROLLER_CLIENT_MESSAGE_CHANNEL_ID,
        constants.AUDIO_CONTROLLER_MESSAGE_CHANNEL_ID,
        { destination: "LOCAL" }
    );

    handler.setHandler("HOOT_GET_GLOBAL_INFO", async function (this: APIHandler<HootAudioControlsMessageRegistry>) {
        return {
            type: "HOOT_GLOBAL_INFO" as const,
            volume: audioHandler.volume,
        }
    });
    
    handler.setHandler("HOOT_GET_AUDIO_INFO", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootGetAudioInfoMessage) {
        const playlist = audioHandler.playing[message.playlist];
        updateMediaSession(audioHandler);
        if (playlist === undefined) {
            return makeErrorMessage(message.id,  "playlist is not loaded");
        }
        return {
            type: "HOOT_AUDIO_INFO" as const,
            title: playlist.currentTrack.name,
            duration: playlist.currentTrackDuration,
            position: playlist.currentTrackPosition,
            shuffle: playlist.shuffle,
            repeat: playlist.repeat,
            playing: playlist.playing,
            volume: playlist.volume,
        };
    });
    
    handler.setHandler("HOOT_GET_PLAYING_INFO", async function (this: APIHandler<HootAudioControlsMessageRegistry>) {
        updateMediaSession(audioHandler);
        return {
            type: "HOOT_PLAYING_INFO" as const,
            playing: Object.fromEntries(Object.entries(audioHandler.playing).map(([key, pc]) => [key, {
                title: pc.currentTrack.name,
                source: pc.currentTrack.source,
                id: pc.currentTrack.id,
                duration: pc.currentTrackDuration,
                position: pc.currentTrackPosition,
                shuffle: pc.shuffle,
                repeat: pc.repeat,
            }])),
        };
    });

    handler.setHandler("HOOT_SET_GLOBAL_VOLUME", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootSetGlobalVolumeMessage) {
        audioHandler.volume = message.volume;
        return { type: "HOOT_SUCCESS" };
    });
    
    handler.setHandler("HOOT_PLAY_AUDIO", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootPlayAudioMessage) {
        try {
            const pc = await audioHandler.playTrack(message.track, message.playlist ?? null, library, message.playOnLoad);
            if (message.playlist !== undefined) {
                const playlist = message.playlist;
                pc.addOnLoadHandler(() => reportTrackChange(playlist));
            }
            if (message.waitForFinish) {
                const promise = new Promise((resolve, reject) => {
                    pc.addOnEndHandler(() => resolve(null));
                    pc.addOnErrorHandler((e: MediaError) => reject(e));
                });
                await promise;
            }
            if (message.playlist) {
                reportTrackChange(message.playlist);
            }
            return { type: "HOOT_SUCCESS" };
        }
        catch (error) {
            logging.error("an error occurred on the HOOT_PLAY_AUDIO handler:", error);
            return makeErrorMessage(message.id, (error as Error).message);
        }
        finally {
            updateMediaSession(audioHandler);
        }
    });

    handler.setHandler("HOOT_PLAY", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootPlayMessage) {
        const playlistController = audioHandler.playing[message.playlist];
        if (playlistController === undefined) {
            return makeErrorMessage(message.id, `playlist "${message.playlist}" is not loaded`);
        }
        try {
            playlistController.play();
            reportTrackChange(message.playlist);
        }
        catch (error) {
            logging.error("an error occurred on the HOOT_PLAY handler:", error);
            return makeErrorMessage(message.id, (error as Error).message);
        }
        finally {
            updateMediaSession(audioHandler);
        }
        return { type: "HOOT_SUCCESS" };
    });
    
    handler.setHandler("HOOT_PAUSE", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootPauseMessage) {
        const playlistController = audioHandler.playing[message.playlist];
        if (playlistController === undefined) {
            return makeErrorMessage(message.id, `playlist "${message.playlist}" is not loaded`);
        }
        try {
            playlistController.pause();
            reportTrackChange(message.playlist);
        }
        catch (error) {
            logging.error("an error occurred on the HOOT_PAUSE handler:", error);
            return makeErrorMessage(message.id, (error as Error).message);
        }
        finally {
            updateMediaSession(audioHandler);
        }
        return { type: "HOOT_SUCCESS" };
    });

    handler.setHandler("HOOT_FADE", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootFadeMessage) {
        const playlistController = audioHandler.playing[message.playlist];
        if (playlistController === undefined) {
            return makeErrorMessage(message.id, `playlist "${message.playlist}" is not loaded`);
        }
        if (playlistController.fading) {
            return makeErrorMessage(message.id, `playlist "${message.playlist}" is already fading`);
        }
        if (message.fade === "in" && playlistController.playing) {
            return makeErrorMessage(message.id, "cannot fade in while track is playing");
        }
        if (message.fade === "out" && !playlistController.playing) {
            return makeErrorMessage(message.id, "cannot fade out while track is paused");
        }
        try {
            const func = message.fade === "in" ? playlistController.fadeIn : playlistController.fadeOut;
            func.call(playlistController, message.duration);
            reportFadeStarted(message);
        }
        catch (error) {
            logging.error("an error occurred on the HOOT_FADE handler:", error);
            return makeErrorMessage(message.id, (error as Error).message);
        }
        finally {
            updateMediaSession(audioHandler);
        }
        return { type: "HOOT_SUCCESS" };
    });

    handler.setHandler("HOOT_NEXT_TRACK", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootNextTrackMessage) {
        const playlistController = audioHandler.playing[message.playlist];
        if (playlistController === undefined) {
            return makeErrorMessage(message.id, `playlist "${message.playlist}" is not loaded`);
        }
        await playlistController.nextTrack(true);
        reportTrackChange(message.playlist);
        return { type: "HOOT_SUCCESS" };
    });

    handler.setHandler("HOOT_PREVIOUS_TRACK", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootPreviousTrackMessage) {
        const playlistController = audioHandler.playing[message.playlist];
        if (playlistController === undefined) {
            return makeErrorMessage(message.id, `playlist "${message.playlist}" is not loaded`);
        }
        await playlistController.previousTrack();
        reportTrackChange(message.playlist);
        return { type: "HOOT_SUCCESS" };
    });

    handler.setHandler("HOOT_SET_VOLUME", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootSetVolumeMessage) {
        const playlistController = audioHandler.playing[message.playlist];
        if (playlistController === undefined) {
            return makeErrorMessage(message.id, `playlist "${message.playlist}" is not loaded`);
        }
        playlistController.volume = message.volume;
        reportTrackChange(message.playlist);
        return { type: "HOOT_SUCCESS" };
    });

    handler.setHandler("HOOT_SEEK", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootSeekMessage) {
        const playlistController = audioHandler.playing[message.playlist];
        if (playlistController === undefined) {
            return makeErrorMessage(message.id, `playlist "${message.playlist}" is not loaded`);
        }
        playlistController.currentTrackPosition = message.position;
        reportTrackChange(message.playlist);
        return { type: "HOOT_SUCCESS" };
    });

    handler.setHandler("HOOT_SET_REPEAT_MODE", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootSetRepeatModeMessage) {
        const playlistController = audioHandler.playing[message.playlist];
        if (playlistController === undefined) {
            return makeErrorMessage(message.id, `playlist "${message.playlist}" is not loaded`);
        }
        playlistController.repeat = message.repeat;
        return { type: "HOOT_SUCCESS" };
    });
    
    handler.setHandler("HOOT_SET_SHUFFLE", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootSetShuffleMessage) {
        const playlistController = audioHandler.playing[message.playlist];
        if (playlistController === undefined) {
            return makeErrorMessage(message.id, `playlist "${message.playlist}" is not loaded`);
        }
        playlistController.shuffle = message.shuffle;
        return { type: "HOOT_SUCCESS" };
    });

    handler.setHandler("HOOT_UNLOAD", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootUnloadMessage) {
        const playlistController = audioHandler.playing[message.playlist];
        if (playlistController === undefined) {
            return makeErrorMessage(message.id, `playlist "${message.playlist}" is not loaded`);
        }
        try {
            playlistController.pause();
            delete audioHandler.playing[message.playlist];
            reportPlaylistChange();
        }
        catch (error) {
            logging.error("an error occurred on the HOOT_UNLOAD handler:", error);
            return makeErrorMessage(message.id, (error as Error).message);
        }
        finally {
            updateMediaSession(audioHandler);
        }
        return { type: "HOOT_SUCCESS" };
    });
    
    handler.setHandler("HOOT_RELOAD_TRACKS", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootReloadTracksMessage) {
        try {
            await library.fetch();
        }
        catch (error) {
            logging.error("an error occurred on the HOOT_RELOAD_TRACKS handler:", error);
            return makeErrorMessage(message.id, (error as Error).message);
        }
        return { type: "HOOT_SUCCESS" };
    });

    handler.register();
}

export async function setup() {
    library.fetch();
    audioHandler.reset();
    setupMediaSession();
    setupModalListener();
    setupAudioControlsAPIHandler();
}
