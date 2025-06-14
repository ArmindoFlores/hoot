/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Track, useTracks } from "./TrackProvider";
import { apiService, isError } from "../services/apiService";

import OBR from "@owlbear-rodeo/sdk";
import { expired } from "../utils";

export type RepeatMode = "no-repeat" | "repeat-all" | "repeat-self";

function omitKey<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [key]: _, ...rest } = obj;
    return rest;
}

interface PlaylistInfo {
    track: Track;
    playing: boolean;
    time: number;
    duration?: number;
    shuffle: boolean;
    loaded: boolean;
    repeatMode: RepeatMode;
    volume: number;
}

interface AudioPlayerContextType {
    volume: number;
    playing: {
        [playlist: string]: PlaylistInfo;
    };
    setVolume: (volume: number, playlist?: string) => void;
    setTrack: (track: Track | undefined, playlist: string) => void;
    setPlaybackTime: (time: number, playlist: string) => void;
    setDuration: (duration: number, playlist: string) => void;
    setShuffle: (shuffle: boolean, playlist: string) => void;
    setLoaded: (loaded: boolean, playlist: string) => void;
    setIsPlaying: (playing: boolean, playlist: string) => void;
    setRepeatMode: (repeatMode: RepeatMode, playlist: string) => void;
    setPlaylist: (playlist: string, info: PlaylistInfo) => void;
}

interface TrackedPromise<T> extends Promise<T> {
    isPending: boolean;
    isFulfilled: boolean;
    isRejected: boolean;
    metadata?: unknown;
}

function trackPromise<T>(promise: Promise<T>, metadata?: unknown): TrackedPromise<T> {
    const tracked: TrackedPromise<T> = promise.then(
        value => {
            tracked.isPending = false;
            tracked.isFulfilled = true;
            return value;
        },
        error => {
            tracked.isPending = false;
            tracked.isRejected = true;
            throw error;
        }
    ) as TrackedPromise<T>;

    tracked.isPending = true;
    tracked.isFulfilled = false;
    tracked.isRejected = false;
    tracked.metadata = metadata;

    return tracked;
}

const AudioPlayerContext = createContext<AudioPlayerContextType>({
    volume: 0.5,
    playing: {},
    setVolume: () => { },
    setTrack: () => { },
    setPlaybackTime: () => { },
    setDuration: () => { },
    setShuffle: () => { },
    setLoaded: () => { },
    setIsPlaying: () => { },
    setRepeatMode: () => { },
    setPlaylist: () => { },
});
export const useAudioPlayer = () => useContext(AudioPlayerContext);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
    const { updateTrack } = useTracks();
    const [volume, setGlobalVolume] = useState<number>(0.5);
    const [playing, setPlaying] = useState<AudioPlayerContextType["playing"]>({});
    const fetchingTrackPromises = useRef<TrackedPromise<void>[]>([]);

    const setVolume = useCallback((volume: number, playlist?: string) => {
        if (playlist === undefined) {
            setGlobalVolume(volume);
        }
        else {
            setPlaying(oldPlaying => ({
                ...oldPlaying,
                [playlist]: {
                    ...oldPlaying[playlist],
                    volume: volume
                }
            }));
        }
    }, []);

    const setTrack = useCallback((track: Track | undefined, playlist: string) => {
        const doWork = (track: Track | undefined) => {
            setPlaying(oldPlaying => {
                if (track === undefined) {
                    return omitKey(oldPlaying, playlist);
                }
                return {
                    ...oldPlaying,
                    [playlist]: oldPlaying[playlist] ? {
                        ...oldPlaying[playlist],
                        track,
                        time: 0,
                    } : {
                        track,
                        playing: false,
                        time: 0,
                        shuffle: false,
                        loaded: false,
                        repeatMode: "repeat-all",
                        volume: 0.75,
                        duration: undefined
                    }
                };
            });
        }

        if (track != undefined && track.id != undefined && (track.source == undefined || expired(track.source_expiration))) {
            // This is a remote track and we have no ID
            apiService.getTrack(track.id).then(result => {
                if (isError(result)) {
                    throw new Error(result.error);
                }
                setTrack(result as Track, playlist);
                updateTrack(result as Track);
                doWork(result as Track);
            }).catch((error: Error) => {
                console.error(error);
                OBR.notification.show(`Couldn't retrieve track source (${error.message})`, "ERROR");
            });
            return;
        }
        doWork(track);

    }, [updateTrack]);

    const setPlaylist = useCallback((playlist: string, info: PlaylistInfo) => {
        setPlaying(oldPlaying => ({
            ...oldPlaying,
            [playlist]: info
        }));
    }, []);

    const setPlaybackTime = useCallback((time: number, playlist: string) => {
        setPlaying(oldPlaying => ({
            ...oldPlaying,
            [playlist]: {
                ...oldPlaying[playlist],
                time
            }
        }));
    }, []);

    const setDuration = useCallback((duration: number, playlist: string) => {
        setPlaying(oldPlaying => ({
            ...oldPlaying,
            [playlist]: {
                ...oldPlaying[playlist],
                duration
            }
        }));
    }, []);

    const setShuffle = useCallback((shuffle: boolean, playlist: string) => {
        setPlaying(oldPlaying => ({
            ...oldPlaying,
            [playlist]: {
                ...oldPlaying[playlist],
                shuffle
            }
        }));
    }, []);

    const setLoaded = useCallback((loaded: boolean, playlist: string) => {
        setPlaying(oldPlaying => ({
            ...oldPlaying,
            [playlist]: {
                ...oldPlaying[playlist],
                loaded
            }
        }));
    }, []);

    const setIsPlaying = useCallback((playing: boolean, playlist: string) => {
        setPlaying(oldPlaying => ({
            ...oldPlaying,
            [playlist]: {
                ...oldPlaying[playlist],
                playing
            }
        }));
    }, []);

    const setRepeatMode = useCallback((repeatMode: RepeatMode, playlist: string) => {
        setPlaying(oldPlaying => ({
            ...oldPlaying,
            [playlist]: {
                ...oldPlaying[playlist],
                repeatMode
            }
        }));
    }, []);

    useEffect(() => {
        fetchingTrackPromises.current = fetchingTrackPromises.current.filter(promise => !promise.isFulfilled);
        const fetchingTrackIds = fetchingTrackPromises.current.map(promise => promise.metadata) as number[];
        for (const [playlist, playlistInfo] of Object.entries(playing)) {
            if (playlistInfo.track == undefined || playlistInfo.track.id == undefined || fetchingTrackIds.includes(playlistInfo.track.id)) continue;
            if (playlistInfo.track.source == undefined || expired(playlistInfo.track.source_expiration)) {
                fetchingTrackPromises.current.push(trackPromise(apiService.getTrack(playlistInfo.track.id).then(result => {
                    if (isError(result)) {
                        throw new Error(result.error);
                    }
                    setTrack(result as Track, playlist);
                    updateTrack(result as Track);
                }).catch((error: Error) => {
                    console.error(error);
                    OBR.notification.show(`Couldn't retrieve track source (${error.message})`, "ERROR");
                }), playlistInfo.track.id));
            }
        }
    }, [playing, setTrack, updateTrack]);

    return <AudioPlayerContext.Provider
        value={{
            volume,
            playing,
            setVolume,
            setTrack,
            setPlaybackTime,
            setDuration,
            setShuffle,
            setLoaded,
            setIsPlaying,
            setRepeatMode,
            setPlaylist
        }}
    >
        {children}
    </AudioPlayerContext.Provider>;
}
