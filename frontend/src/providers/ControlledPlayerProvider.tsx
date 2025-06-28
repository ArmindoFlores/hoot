/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { Track } from "../types/tracks";
import { logging } from "../logging";

export interface AudioObject {
    id: string;
    context: AudioContext;
    gain: GainNode;
    playerGain: GainNode;
    audio: HTMLAudioElement;
    source: MediaElementAudioSourceNode;
    onLoad?: () => void;
    onError?: (err: ErrorEvent) => void;
}

interface ControlledPlayerContextType {
    volume: number;
    playing: Record<string, AudioObject|null>;

    unloadTrack: (id: string) => void;
    loadTrack: (id: string, url: string, name: string, trackId: string) => Promise<AudioObject>;
    getTrack: (id: string) => AudioObject|null|undefined;
    setVolume: (volume: number) => void;
}

const ControlledPlayerContext = createContext<ControlledPlayerContextType|null>(null);

function cleanupAudioNodes(elements: AudioObject) {
    if (elements.onLoad) {
        elements.audio.removeEventListener("canplaythrough", elements.onLoad);
    }
    if (elements.onError) {
        elements.audio.removeEventListener("error", elements.onError);
    }

    elements.audio.src = "";
    elements.audio.load();
    elements.source.disconnect();
    elements.gain.disconnect();
    elements.playerGain.disconnect();
}

function setupAudioNodes(
    context: AudioContext,
    globalGain: GainNode,
    id: string,
    track: Track,
    onLoad?: (track: AudioObject) => void,
    onError?: (e: MediaError) => void,
): AudioObject {
    const gainNode = context.createGain();
    gainNode.gain.setValueAtTime(1, 0);
    const playerGainNode = context.createGain();
    playerGainNode.gain.setValueAtTime(1, 0);
    const audio = new Audio(track.source!);
    const source = context.createMediaElementSource(audio);
    audio.crossOrigin = "anonymous";

    const trueOnError = onError ? () => onError(audio.error!) : undefined;
    if (onError && trueOnError) {
        audio.addEventListener("error", trueOnError, { once: true });
    }

    const trueOnLoad = onLoad ? () => onLoad({
        context,
        id,
        gain: gainNode,
        playerGain: playerGainNode,
        audio,
        source,
        onLoad: trueOnLoad,
        onError: trueOnError,
    }) : undefined;
    if (onLoad && trueOnLoad) {
        audio.addEventListener(
            "canplaythrough",
            trueOnLoad,
            { once: true }
        );
    }

    audio.preload = "auto";
    audio.load();
    source.connect(gainNode).connect(playerGainNode).connect(globalGain);

    return {
        context,
        id,
        gain: gainNode,
        playerGain: playerGainNode,
        audio,
        source,
        onLoad: trueOnLoad,
        onError: trueOnError,
    };
}

export function ControlledPlayerProvider({ children }: { children: React.ReactNode }) {
    const audioContextRef = useRef(new AudioContext());
    const globalGainRef = useRef<GainNode>();
    const [playing, setPlaying] = useState<Record<string, AudioObject|null>>({});
    const [volume, setVolume] = useState(1);

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
        const now = audioContextRef.current.currentTime;
        globalGainRef.current.gain.cancelScheduledValues(now);
        globalGainRef.current.gain.setValueAtTime(volume, now);
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

    const loadTrack = useCallback((id: string, url: string, name: string, trackId: string): Promise<AudioObject> => {
        return new Promise((resolve, reject) => {
            setPlaying(prev => {
                if (globalGainRef.current == undefined) {
                    reject(new Error("Tried to load track before setup was complete"));
                    return prev;
                }
               
                const track = prev[id];
                if (track) {
                    cleanupAudioNodes(track);
                }

                const newTrack = setupAudioNodes(
                    audioContextRef.current,
                    globalGainRef.current,
                    trackId,
                    {
                        id: undefined as unknown as number, //FIXME: this might cause problems
                        name: name,
                        source: url,
                        source_expiration: null,
                        size: 0,
                    },
                    resolve,
                    err => reject(err ?? new Error("Audio failed to load")),
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

    return <ControlledPlayerContext.Provider
        value={{
            playing,
            getTrack,
            unloadTrack,
            loadTrack,
            setVolume,
            volume,
        }}
    >
        {children}
    </ControlledPlayerContext.Provider>;
}

export function useControlledAudio() {
    const ctx = useContext(ControlledPlayerContext);
    if (!ctx) throw new Error("useControlledAudio() must be used within an ControlledPlayerProvider");
    return ctx;
}
