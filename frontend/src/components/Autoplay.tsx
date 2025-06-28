import { useEffect, useRef } from "react";

import { APP_KEY } from "../config";
import OBR from "@owlbear-rodeo/sdk";
import { RepeatMode } from "../types/tracks";
import { logging } from "../logging";
import { useAudio } from "../providers/AudioPlayerProvider";
import { useOBRBase } from "../hooks";
import { useSettings } from "../providers/SettingsProvider";
import { useTracks } from "../providers/TrackProvider";

export const AUTOPLAY_METADATA_KEY = `${APP_KEY}/autoplay`;

export type AutoplayList = {
    playlist: string;
    track: string;
    volume: number;
    shuffle: boolean;
    fadeIn: boolean;
    repeatMode: RepeatMode;
}[];

export function Autoplay() {
    const { tracks, loadOnlineTrack, tracksLoaded } = useTracks();
    const { loadTrack, fadeInTrack } = useAudio();
    const { enableAutoplay, fadeTime } = useSettings();
    const { sceneReady } = useOBRBase();
    const hasAutoplayed = useRef(true);

    useEffect(() => {
        if (sceneReady && enableAutoplay && tracksLoaded) {
            hasAutoplayed.current = false;
        }
    }, [sceneReady, enableAutoplay, tracksLoaded]);
    
    useEffect(() => {
        if (!enableAutoplay || !sceneReady || hasAutoplayed.current || !tracksLoaded) {
            return;
        }
        hasAutoplayed.current = true;
        OBR.scene.getMetadata().then(sceneMetadata => {
            const autoplay = sceneMetadata[AUTOPLAY_METADATA_KEY] as (AutoplayList|undefined);
            if (autoplay == undefined || autoplay.length == 0) return;

            for (const track of autoplay) {
                const playlistTracks = tracks.get(track.playlist);
                if (playlistTracks == undefined) {
                    logging.warn(`(autoplay) Tried to play track "${track.track}" from playlist "${track.playlist}", but that playlist doesn't exist`);
                    continue;
                }
                const playlistTrack = playlistTracks.find(t => t.name === track.track);
                if (playlistTrack == undefined) {
                    logging.warn(`(autoplay) Tried to play track "${track.track}" from playlist "${track.playlist}", but that playlist doesn't contain it`);
                    continue;
                }
                loadOnlineTrack(playlistTrack).then(updatedTrack => {
                    loadTrack(track.playlist, updatedTrack.source!, updatedTrack.name, updatedTrack.id.toString(), track.shuffle, track.repeatMode).then(audioObject => {
                        audioObject.audioElements.gain.gain.setValueAtTime(
                            track.volume,
                            audioObject.audioElements.gain.context.currentTime
                        );
                        audioObject.audioElements.context.resume().then(() => {
                            if (track.fadeIn) {
                                fadeInTrack(track.playlist, fadeTime).catch(err => logging.error(err));
                            }
                            else {
                                audioObject.audioElements.audio.play().catch(err => logging.error(err));
                            }
                        });
                    });
                });
            }
        });
    }, [enableAutoplay, sceneReady, tracks, loadOnlineTrack, loadTrack, tracksLoaded, fadeInTrack, fadeTime]);

    return null;
}
