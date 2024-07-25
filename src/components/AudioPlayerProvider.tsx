import React, { createContext, useCallback, useContext, useState } from "react";

import { Track } from "./TrackProvider";

export type RepeatMode = "no-repeat" | "repeat-all" | "repeat-self";

function omitKey<T extends object, K extends keyof T>(obj: T, key: K): Omit<T, K> {
    const { [key]: _, ...rest } = obj;
    return rest;
}

interface AudioPlayerContextType {
    volume: number;
    playing: {
        [playlist: string]: {
            track: Track;
            playing: boolean;
            time: number;
            duration?: number;
            shuffle: boolean;
            autoplay: boolean;
            repeatMode: RepeatMode;
            volume: number;
        };
    };
    setVolume: (volume: number, playlist?: string) => void;
    setTrack: (track: Track | undefined, playlist: string) => void;
    setPlaybackTime: (time: number, playlist: string) => void;
    setDuration: (duration: number, playlist: string) => void;
    setShuffle: (shuffle: boolean, playlist: string) => void;
    setAutoplay: (autoplay: boolean, playlist: string) => void;
    setIsPlaying: (playing: boolean, playlist: string) => void;
    setRepeatMode: (repeatMode: RepeatMode, playlist: string) => void;
};

const AudioPlayerContext = createContext<AudioPlayerContextType>({ 
    volume: 0.5, 
    playing: {}, 
    setVolume: () => {},
    setTrack: () => {},
    setPlaybackTime: () => {},
    setDuration: () => {},
    setShuffle: () => {},
    setAutoplay: () => {},
    setIsPlaying: () => {},
    setRepeatMode: () => {},
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
    }, [playing]);

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
                    autoplay: true,
                    repeatMode: "repeat-all",
                    volume: 0.5,
                    duration: undefined
                }
            };
        });
    }, [playing]);

    const setPlaybackTime = useCallback((time: number, playlist: string) => {
        setPlaying(oldPlaying => ({
            ...oldPlaying,
            [playlist]: {
                ...oldPlaying[playlist],
                time
            }
        }));
    }, [playing]);

    const setDuration = useCallback((duration: number, playlist: string) => {
        setPlaying(oldPlaying => ({
            ...oldPlaying,
            [playlist]: {
                ...oldPlaying[playlist],
                duration
            }
        }));
    }, [playing]);

    const setShuffle = useCallback((shuffle: boolean, playlist: string) => {
        setPlaying(oldPlaying => ({
            ...oldPlaying,
            [playlist]: {
                ...oldPlaying[playlist],
                shuffle
            }
        }));
    }, [playing]);

    const setAutoplay = useCallback((autoplay: boolean, playlist: string) => {
        setPlaying(oldPlaying => ({
            ...oldPlaying,
            [playlist]: {
                ...oldPlaying[playlist],
                autoplay
            }
        }));
    }, [playing]);

    const setIsPlaying = useCallback((playing: boolean, playlist: string) => {
        setPlaying(oldPlaying => ({
            ...oldPlaying,
            [playlist]: {
                ...oldPlaying[playlist],
                playing
            }
        }));
    }, [playing]);

    const setRepeatMode = useCallback((repeatMode: RepeatMode, playlist: string) => {
        setPlaying(oldPlaying => ({
            ...oldPlaying,
            [playlist]: {
                ...oldPlaying[playlist],
                repeatMode
            }
        }));
    }, [playing]);

    return <AudioPlayerContext.Provider 
        value={{
            volume, 
            playing, 
            setVolume, 
            setTrack, 
            setPlaybackTime,
            setDuration,
            setShuffle,
            setAutoplay,
            setIsPlaying,
            setRepeatMode,
        }}
    >
        { children }
    </AudioPlayerContext.Provider>;
}
