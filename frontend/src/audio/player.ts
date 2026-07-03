import { APIHandler } from "@armindoflores/obr-ext-core";
import { AudioHandler } from "./audioHandler";
import { HootAsyncUpdatesMessageRegistry } from "../types/broadcast/asyncUpdates";
import { HootPlaylistAudioInfoMessage } from "../types/broadcast/messages";
import { NoResponse } from "@armindoflores/obr-ext-core/utils";
import { constants } from "../constants";
import { logging } from "../logging";
import { setupMediaSession } from "./mediaSession";

const audioHandler = new AudioHandler();
window.audioHandler = audioHandler;

async function updatePlaylist(playlist: string, info: HootPlaylistAudioInfoMessage) {
    try {
        logging.info("Updating playlist:", playlist, info);
        const trackId = audioHandler.playing[playlist]?.currentTrackId;
        logging.info(audioHandler.playing, audioHandler.playing[playlist] === undefined, trackId !== info.trackId);
        if (audioHandler.playing[playlist] === undefined || trackId !== info.trackId) {
            // FIXME: start playing at the right time
            if (audioHandler.playing[playlist]) {
                audioHandler.closePlaylist(playlist);
            }
            logging.info("playing track", trackId, info.trackId);
            const pc = await audioHandler.playTrack({
                id: info.trackId,
                name: info.title,
                size: 0,
                source: info.source,
                source_expiration: null
            }, null, undefined, info.playing);
            audioHandler.playing[playlist] = pc;
            pc.addOnEndHandler(() => {
                audioHandler.closePlaylist(playlist);
            });
            pc.addOnErrorHandler(error => logging.error(error));
        }
        else {
            const pc = audioHandler.playing[playlist];
            if (pc.playing && !info.playing) {
                logging.info("Pausing playback");
                pc.pause();
            }
            else if (!pc.playing && info.playing) {
                logging.info("Re-starting playback");
                await pc.play();
            }
            if (pc.volume !== info.volume) {
                logging.info("Adjusting current track volume:", pc.volume, "->", info.volume);
                pc.volume = info.volume;
            }
            if (Math.abs(pc.currentTrackPosition - info.position) > 1) {
                // If tracks have drifted by more than 1 second
                // FIXME: figure out whether a smarter implementation is required,
                // such as using a timestamp on the sender and comparing that to the 
                // previous difference between position and timestamp
                logging.info("Adjusting current track position:", pc.currentTrackPosition, "->", info.position);
                pc.currentTrackPosition = info.position;
            }
        }
    } catch (e) {
        logging.error(e);
    }
}

async function fadePlaylist(playlist: string, type: "in" | "out", duration: number) {
    // FIXME: to fully implement fade-in/fade-out even when a track change occurrs,
    // we must keep track of playlists currently fading and, when a track changes there,
    // trigger a fade-in with a duration and starting volume based on how much time has
    // passed since fade started
    const pc = audioHandler.playing[playlist];
    if (pc === undefined) {
        return;
    }
    if (type === "in") {
        await pc.fadeIn(duration);
    }
    else if (type === "out") {
        await pc.fadeOut(duration);
    }
}

function setupAsyncUpdatesAPIHandler() {
    const handler = new APIHandler<HootAsyncUpdatesMessageRegistry>(
        constants.ASYNC_UPDATES_MESSAGE_CHANNEL_ID,
        constants.ASYNC_UPDATES_MESSAGE_CHANNEL_ID,
    );

    handler.setHandler("HOOT_PLAYING_INFO", async message => {
        const playing = Object.keys(message.playing);
        for (const playlist of Object.keys(audioHandler.playing)) {
            if (!playing.includes(playlist)) {
                audioHandler.closePlaylist(playlist);
            }
        }
        return NoResponse;
    });

    handler.setHandler("HOOT_AUDIO_INFO", async message => {
        await updatePlaylist(message.playlist, message);
        return NoResponse;
    });

    handler.setHandler("HOOT_FADE", async message => {
        await fadePlaylist(message.playlist, message.fade, message.duration);
        return NoResponse;
    });

    handler.register();
}

function setupContextStateMonitor() {
    setInterval(() => {
        if (audioHandler.state === "suspended") {
            audioHandler.resume();
        }
    }, 500);
}

export async function setup() {
    audioHandler.reset();
    setupMediaSession();
    setupAsyncUpdatesAPIHandler();
    setupContextStateMonitor();
    logging.info("Setup complete");
}
