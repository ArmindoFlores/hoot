import { APIHandler, ClientAPI } from "@armindoflores/obr-ext-core";
import { HootFadeMessage, HootGetAudioInfoMessage, HootNextTrackMessage, HootPauseMessage, HootPlayAudioMessage, HootPlayMessage, HootPreviousTrackMessage, HootReloadTracksMessage, HootSeekMessage, HootSetGlobalVolumeMessage, HootSetRepeatModeMessage, HootSetShuffleMessage, HootSetVolumeMessage, HootUnloadMessage } from "../types/broadcast/messages";

import { HootAsyncUpdatesMessageRegistry } from "../types/broadcast/asyncUpdates";
import { HootAudioControlsMessageRegistry } from "../types/broadcast/audioControls";
import OBR from "@owlbear-rodeo/sdk";
import { PlaylistController } from "./playlistController";
import { Track } from "../types/tracks";
import { TrackLibrary } from "./tracks";
import { constants } from "../constants";
import { logging } from "../logging";
import { makeErrorMessage } from "@armindoflores/obr-ext-core/utils";

let ctx: AudioContext;
let gain: GainNode;
const asyncUpdatesClient = new ClientAPI<HootAsyncUpdatesMessageRegistry>(
    constants.ASYNC_UPDATES_MESSAGE_CHANNEL_ID,
    constants.ASYNC_UPDATES_MESSAGE_CHANNEL_ID,
    "ALL"
);
const library = new TrackLibrary();
const playing: Record<string, PlaylistController> = {};

function initGlobalAudioContext() {
    logging.info("Initializing audio context...");
    ctx = new AudioContext();
    gain = ctx.createGain();
    gain.gain.setValueAtTime(1, 0);
    gain.connect(ctx.destination);
    logging.info("done initializing audio context!");
    ctx.resume();
}

function setGlobalVolume(volume: number) {
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(volume, now);
}

function getGlobalVolume(): number {
    return gain.gain.value;
}

function reportPlaylistChange() {
    asyncUpdatesClient.send<"HOOT_PLAYING_INFO">(
        {
            type: "HOOT_PLAYING_INFO",
            playing: Object.fromEntries(Object.entries(playing).map(([k, v]) => [
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

function reportTrackChange(playlist: string) {
    const pc = playing[playlist];
    if (pc === undefined || pc.currentTrack === undefined) {
        reportPlaylistChange();
        return;
    }
    asyncUpdatesClient.send<"HOOT_AUDIO_INFO">(
        {
            type: "HOOT_AUDIO_INFO",
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

async function playTrack(track: Track | number, playlist: string | null, playOnLoad?: boolean): Promise<PlaylistController> {
    const isCustomTrack = typeof track === "object";
    const isStandalone = playlist === null;
    const trackId = isCustomTrack ? track.id : track;
    const alreadyPlaying = (playlist === null || playing[playlist] === undefined) ? false : playing[playlist].playing;
    const pc = !isStandalone && playing[playlist] ? playing[playlist] : new PlaylistController(ctx, gain, library, playlist);
    if (playlist !== null) {
        playing[playlist] = pc;
    }
    if (isCustomTrack) {
        pc.addCustomTrack(track);
    }
    if (!isStandalone) {
        pc.addOnLoadHandler(() => reportTrackChange(playlist));
    }
    await pc.playTrack(trackId, isStandalone ? true : (alreadyPlaying ? true : playOnLoad ?? false));
    return pc;
}

function defaultMetadata() {
    return new MediaMetadata({
        album: "Hoot",
        artwork: [{ src: "/hoot.webp", sizes: "1024x1024", type: "image/webp" }]
    });
}

function setupMediaSession() {
    navigator.mediaSession.metadata = defaultMetadata();
    navigator.mediaSession.playbackState = "paused";
}

function updateMediaSession() {
    const mediaSession = navigator.mediaSession;
    const metadata = navigator.mediaSession.metadata ?? defaultMetadata();
    const playingPlaylists = Object.entries(playing).filter(kv => kv[1].playing);

    metadata.title = playingPlaylists.map(kv => kv[1].currentTrack.name).join(" / ");
    metadata.artist = playingPlaylists.map(kv => kv[0]).join(" / ");
    mediaSession.playbackState = playingPlaylists.length > 0 ? "playing" : "paused";
    mediaSession.metadata = metadata;
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
            volume: getGlobalVolume(),
        }
    });
    
    handler.setHandler("HOOT_GET_AUDIO_INFO", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootGetAudioInfoMessage) {
        const playlist = playing[message.playlist];
        updateMediaSession();
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
        updateMediaSession();
        return {
            type: "HOOT_PLAYING_INFO" as const,
            playing: Object.fromEntries(Object.entries(playing).map(([key, pc]) => [key, {
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
        setGlobalVolume(message.volume);
        return { type: "HOOT_SUCCESS" };
    });
    
    handler.setHandler("HOOT_PLAY_AUDIO", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootPlayAudioMessage) {
        try {
            const pc = await playTrack(message.track, message.playlist ?? null, message.playOnLoad);
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
            updateMediaSession();
        }
    });

    handler.setHandler("HOOT_PLAY", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootPlayMessage) {
        const playlistController = playing[message.playlist];
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
            updateMediaSession();
        }
        return { type: "HOOT_SUCCESS" };
    });
    
    handler.setHandler("HOOT_PAUSE", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootPauseMessage) {
        const playlistController = playing[message.playlist];
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
            updateMediaSession();
        }
        return { type: "HOOT_SUCCESS" };
    });

    handler.setHandler("HOOT_FADE", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootFadeMessage) {
        const playlistController = playing[message.playlist];
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
            updateMediaSession();
        }
        return { type: "HOOT_SUCCESS" };
    });

    handler.setHandler("HOOT_NEXT_TRACK", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootNextTrackMessage) {
        const playlistController = playing[message.playlist];
        if (playlistController === undefined) {
            return makeErrorMessage(message.id, `playlist "${message.playlist}" is not loaded`);
        }
        await playlistController.nextTrack(true);
        reportTrackChange(message.playlist);
        return { type: "HOOT_SUCCESS" };
    });

    handler.setHandler("HOOT_PREVIOUS_TRACK", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootPreviousTrackMessage) {
        const playlistController = playing[message.playlist];
        if (playlistController === undefined) {
            return makeErrorMessage(message.id, `playlist "${message.playlist}" is not loaded`);
        }
        await playlistController.previousTrack();
        reportTrackChange(message.playlist);
        return { type: "HOOT_SUCCESS" };
    });

    handler.setHandler("HOOT_SET_VOLUME", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootSetVolumeMessage) {
        const playlistController = playing[message.playlist];
        if (playlistController === undefined) {
            return makeErrorMessage(message.id, `playlist "${message.playlist}" is not loaded`);
        }
        playlistController.volume = message.volume;
        reportTrackChange(message.playlist);
        return { type: "HOOT_SUCCESS" };
    });

    handler.setHandler("HOOT_SEEK", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootSeekMessage) {
        const playlistController = playing[message.playlist];
        if (playlistController === undefined) {
            return makeErrorMessage(message.id, `playlist "${message.playlist}" is not loaded`);
        }
        playlistController.currentTrackPosition = message.position;
        reportTrackChange(message.playlist);
        return { type: "HOOT_SUCCESS" };
    });

    handler.setHandler("HOOT_SET_REPEAT_MODE", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootSetRepeatModeMessage) {
        const playlistController = playing[message.playlist];
        if (playlistController === undefined) {
            return makeErrorMessage(message.id, `playlist "${message.playlist}" is not loaded`);
        }
        playlistController.repeat = message.repeat;
        return { type: "HOOT_SUCCESS" };
    });
    
    handler.setHandler("HOOT_SET_SHUFFLE", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootSetShuffleMessage) {
        const playlistController = playing[message.playlist];
        if (playlistController === undefined) {
            return makeErrorMessage(message.id, `playlist "${message.playlist}" is not loaded`);
        }
        playlistController.shuffle = message.shuffle;
        return { type: "HOOT_SUCCESS" };
    });

    handler.setHandler("HOOT_UNLOAD", async function (this: APIHandler<HootAudioControlsMessageRegistry>, message: HootUnloadMessage) {
        const playlistController = playing[message.playlist];
        if (playlistController === undefined) {
            return makeErrorMessage(message.id, `playlist "${message.playlist}" is not loaded`);
        }
        try {
            playlistController.pause();
            delete playing[message.playlist];
            reportPlaylistChange();
        }
        catch (error) {
            logging.error("an error occurred on the HOOT_UNLOAD handler:", error);
            return makeErrorMessage(message.id, (error as Error).message);
        }
        finally {
            updateMediaSession();
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
    initGlobalAudioContext();
    setupMediaSession();
    setupModalListener();
    setupAudioControlsAPIHandler();
}
