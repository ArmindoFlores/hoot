import React, { createContext, useCallback, useContext, useState } from "react";

import { Track } from "./TrackProvider";

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

const AudioPlayerContext = createContext<AudioPlayerContextType>({ 
    volume: 0.5, 
    playing: {}, 
    setVolume: () => {},
    setTrack: () => {},
    setPlaybackTime: () => {},
    setDuration: () => {},
    setShuffle: () => {},
    setLoaded: () => {},
    setIsPlaying: () => {},
    setRepeatMode: () => {},
    setPlaylist: () => {},
});
export const useAudioPlayer = () => useContext(AudioPlayerContext);

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
    const [ volume, setGlobalVolume ] = useState<number>(0.5);
    const [ playing, setPlaying ] = useState<AudioPlayerContextType["playing"]>({});

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
    }, []);

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
        { children }
    </AudioPlayerContext.Provider>;
}
