/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { logging } from "../logging";

export interface AudioObject {
    sourceURL: string;
    name: string;
    gain: GainNode;
    audio: HTMLAudioElement;
    source: MediaElementAudioSourceNode;
    onEnd?: () => void;
    onLoad?: () => void;
    onError?: (err: ErrorEvent) => void;
}

interface GlobalAudioContextType {
    volume: number;
    playing: Record<string, AudioObject|null>;

    unloadTrack: (id: string) => void;
    loadTrack: (id: string, url: string, name: string) => Promise<AudioObject>;
    getTrack: (id: string) => AudioObject|null|undefined;
    setVolume: (volume: number) => void;
}

interface AudioPlayerControls {
    src: string | null;
    name: string | null;
    playing: boolean;
    loaded: boolean;
    duration: number | null;
    volume: number;
    position: number | null;
    load: (src: string, name: string) => Promise<void>;
    play: () => void;
    pause: () => void;
    fadeIn: (duration: number) => Promise<void>;
    fadeOut: (duration: number) => Promise<void>;
    setVolume: (volume: number) => void;
    seek: (position: number) => void;
}

const AudioPlayerContext = createContext<GlobalAudioContextType|null>(null);

function cleanupAudioNodes(track: AudioObject) {
    if (track.onLoad) {
        track.audio.removeEventListener("canplaythrough", track.onLoad);
    }
    if (track.onError) {
        track.audio.removeEventListener("error", track.onError);
    }

    track.audio.src = "";
    track.audio.load();
    track.source.disconnect();
    track.gain.disconnect();
}

function setupAudioNodes(context: AudioContext, globalGain: GainNode, url: string, name: string, onLoad?: (track: AudioObject) => void, onError?: (e: ErrorEvent) => void): AudioObject {
    const gainNode = context.createGain();
    gainNode.gain.setValueAtTime(1, 0);
    const audio = new Audio(url);
    const source = context.createMediaElementSource(audio);
    audio.crossOrigin = "anonymous";

    const trueOnLoad = onLoad ? () => onLoad({ sourceURL: url, name, gain: gainNode, audio, source, onLoad: trueOnLoad, onError }) : undefined;
    if (onLoad && trueOnLoad) {
        audio.addEventListener(
            "canplaythrough",
            trueOnLoad,
            { once: true }
        );
    }

    if (onError) {
        audio.addEventListener("error", onError, { once: true });
    }

    audio.preload = "auto";
    audio.load();
    source.connect(gainNode).connect(globalGain);

    return {
        sourceURL: url,
        name,
        gain: gainNode,
        audio,
        source,
        onLoad: trueOnLoad,
        onError,
    };
}

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
    const audioContextRef = useRef(new AudioContext());
    const globalGainRef = useRef<GainNode>();
    const [playing, setPlaying] = useState<Record<string, AudioObject|null>>({});
    const [volume, setVolume] = useState<number>(1);

    useEffect(() => {
        const context = audioContextRef.current;
        const gain = context.createGain();
        gain.gain.setValueAtTime(1, 0);
        globalGainRef.current = gain;
        gain.connect(context.destination);

        return () => {
            gain.disconnect();
        }
    }, []);

    useEffect(() => {
        if (globalGainRef.current == undefined) return;
        globalGainRef.current.gain.value = volume;
    }, [volume]);

    const unloadTrack = useCallback((id: string) => {
        setPlaying(prev => {
            const track = prev[id];
            if (!track) {
                logging.warn("Tried to unload an already unloaded source.");
                return prev;
            }
            cleanupAudioNodes(track);
            const next = { ...prev };
            delete next[id];
            return next;
        });
    }, []);

    const loadTrack = useCallback((id: string, url: string, name: string): Promise<AudioObject> => {
        return new Promise((resolve, reject) => {
            setPlaying(prev => {
                if (globalGainRef.current == undefined) {
                    reject(new Error("Tried to load track before setup was complete"));
                    return prev;
                }
                const track = prev[id];                
                if (track != undefined) {
                    cleanupAudioNodes(track);
                }
                
                const newTrack = setupAudioNodes(
                    audioContextRef.current,
                    globalGainRef.current,
                    url,
                    name,
                    track => { logging.info("Track loaded:", track); resolve(track) },
                    err => reject(err.error ?? new Error("Audio failed to load")),
                );
    
                return {
                    ...prev,
                    [id]: newTrack,
                };
            });
        });
    }, []);

    const getTrack = useCallback((id: string) => {
        return playing[id];
    }, [playing]);

    return <AudioPlayerContext.Provider
        value={{
            playing,
            getTrack,
            unloadTrack,
            loadTrack,
            setVolume,
            volume
        }}
    >
        {children}
    </AudioPlayerContext.Provider>;
}

export function useAudio() {
    const ctx = useContext(AudioPlayerContext);
    if (!ctx) throw new Error("useAudio() must be used within an AudioPlayerProvider");
    return ctx;
}

export function useAudioControls(id: string): AudioPlayerControls {
    const {
        loadTrack,
        getTrack,
    } = useAudio();
    const [src, setSrc] = useState<string|null>(null);
    const [playing, setPlaying] = useState(false);
    const [volume, _setVolume] = useState(1);
    const [loaded, setLoaded] = useState(false);
    const [duration, setDuration] = useState<number|null>(null);
    const [position, setPosition] = useState<number|null>(null);
    const [name, setName] = useState<string|null>(null);

    useEffect(() => {
        let raf: number;
        const track = getTrack(id);
        if (!track) return;

        const updatePosition = () => {
            setPosition(track.audio.currentTime);
            raf = requestAnimationFrame(updatePosition);
        };

        raf = requestAnimationFrame(updatePosition);

        return () => {
            cancelAnimationFrame(raf);
        };
    }, [id, getTrack]);

    useEffect(() => {
        const track = getTrack(id);
        if (!track) return;
        setSrc(track.audio.src);
        setName(track.name);
        _setVolume(track.gain.gain.value);
        if (track.audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
            setDuration(track.audio.duration);
        }
        if (track.audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
            setLoaded(true);
            setPosition(track.audio.currentTime);
            setPlaying(!track.audio.paused);
        }
    }, [id, getTrack]);

    const load = useCallback(async (src: string, name: string) => {
        if (src == undefined) return;
        logging.info(`[CHANNEL ${id}] Loading track from ${src}`);
        setSrc(src);
        setName(name);
        setPosition(0);
        loadTrack(id, src, name).then(track => {
            setLoaded(true);
            setDuration(track.audio.duration);
        });
    }, [id, loadTrack]);

    const play = useCallback(() => {
        const track = getTrack(id);
        if (!track) return;
        track.audio.play().then(() => setPlaying(true));
    }, [id, getTrack]);

    const pause = useCallback(() => {
        const track = getTrack(id);
        if (!track) return;
        track.audio.pause();
        setPlaying(false);
    }, [id, getTrack]);

    const fadeIn = useCallback((duration: number): Promise<void> => {
        return new Promise((resolve, reject) => {
            const track = getTrack(id);
            if (!track) {
                reject(new Error("Fade-in failed: no audio track to fade"));
                return;
            }

            logging.info(`[CHANNEL ${id}] Fading in...`);
            const context = track.gain.context;
            const now = context.currentTime;

            track.gain.gain.cancelScheduledValues(now);
            track.gain.gain.setValueAtTime(0, now);
            track.gain.gain.linearRampToValueAtTime(1, now + duration / 1000);
            track.audio.play();
            setPlaying(true);

            setTimeout(() => {
                resolve();
            }, duration);
        });
    }, [id, getTrack]);

    const fadeOut = useCallback((duration: number): Promise<void> => {
        return new Promise((resolve, reject) => {
            const track = getTrack(id);
            if (!track) {
                reject(new Error("Fade-out failed: no audio track to fade"));
                return;
            }

            const context = track.gain.context;
            const now = context.currentTime;

            logging.info(`[CHANNEL ${id}] Fading out...`);
            track.gain.gain.cancelScheduledValues(now);
            track.gain.gain.linearRampToValueAtTime(0, now + duration / 1000);
        
            setTimeout(() => {
                resolve();
                setPlaying(false);
                track.audio.pause();
            }, duration);
        });
    }, [id, getTrack]);

    const setVolume = useCallback((volume: number) => {
        const track = getTrack(id);
        if (!track) return;

        const context = track.gain.context;
        const now = context.currentTime;
        track.gain.gain.setValueAtTime(volume, now);
        _setVolume(volume);
    }, [id, getTrack]);

    const seek = useCallback((time: number) => {
        const track = getTrack(id);
        if (track == undefined) return;

        track.audio.currentTime = time;
    }, [id, getTrack]);

    return useMemo(() => ({
        src,
        name,
        playing,
        volume,
        loaded,
        duration,
        load,
        play,
        pause,
        setVolume,
        position,
        fadeIn,
        fadeOut,
        seek,
    }), [src, name, playing, volume, loaded, duration, load, play, pause, position, fadeIn, fadeOut, seek, setVolume]);
}
