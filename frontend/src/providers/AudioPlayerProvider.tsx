/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { RepeatMode, Track } from "../types/tracks";

import { INTERNAL_BROADCAST_CHANNEL } from "../config";
import { MessageContent } from "../types/messages";
import { logging } from "../logging";
import uniqueId from "lodash/uniqueId";
import { useOBRBroadcast } from "../hooks/obr";
import { useThrottled } from "../hooks";
import { useTracks } from "./TrackProvider";

export interface AudioElements {
    nextTrack?: Track;
    context: AudioContext;
    gain: GainNode;
    audio: HTMLAudioElement;
    source: MediaElementAudioSourceNode;
    onEnd?: () => void;
    onLoad?: () => void;
    onError?: (err: ErrorEvent) => void;
}

export interface AudioObject {
    id: string;
    track: Track;
    shuffle: boolean;
    repeatMode: RepeatMode;
    updateCount: number;
}

interface GlobalAudioContextType {
    volume: number;
    playing: Record<string, AudioObject|null>;

    unloadTrack: (id: string) => void;
    loadTrack: (id: string, url: string, name: string, trackId?: string, shuffle?: boolean, repeatMode?: RepeatMode) => Promise<{ audioObject: AudioObject, audioElements: AudioElements }>;
    updateTrack: (id: string, trackId: string, shuffle?: boolean, repeatMode?: RepeatMode) => void;
    getTrack: (id: string) => AudioObject|null|undefined;
    getTrackElements: (id: string) => AudioElements|undefined;
    getNextTrack: (id: string) => Track|null;
    getPreviousTrack: (id: string) => Track|null;
    setVolume: (volume: number) => void;
    fadeInTrack: (channel: string, duration: number) => Promise<void>;
    fadeOutTrack: (channel: string, duration: number) => Promise<void>;
    triggerEvent: () => void;
}

interface AudioPlayerControls {
    id: string | null;
    src: string | null;
    name: string | null;
    playing: boolean;
    loaded: boolean;
    duration: number | null;
    volume: number;
    position: number | null;
    shuffle: boolean;
    repeatMode: RepeatMode;
    error: Error | MediaError | null;
    load: (src: string, name: string, id?: string) => Promise<void>;
    reload: () => Promise<void>;
    play: () => Promise<void>;
    pause: () => void;
    fadeIn: (duration: number) => Promise<void>;
    fadeOut: (duration: number) => Promise<void>;
    setVolume: (volume: number) => void;
    setShuffle: (shuffle: boolean) => void;
    setRepeatMode: (repeatMode: RepeatMode) => void;
    next: () => Promise<void>;
    prev: () => Promise<void>;
    seek: (position: number) => void;
}

const AudioPlayerContext = createContext<GlobalAudioContextType|null>(null);

function uuid() {
    return uniqueId("hoot_anonymous_track_");
}

function mod(x: number, y: number) {
    return x >= 0 ? x % y : y + x % y;
}

function cleanupAudioNodes(elements: AudioElements) {
    if (elements.onLoad) {
        elements.audio.removeEventListener("canplaythrough", elements.onLoad);
    }
    if (elements.onError) {
        elements.audio.removeEventListener("error", elements.onError);
    }
    if (elements.onEnd) {
        elements.audio.removeEventListener("ended", elements.onEnd);
    }

    elements.audio.src = "";
    elements.audio.load();
    elements.source.disconnect();
    elements.gain.disconnect();
}

function setupAudioNodes(
    context: AudioContext,
    globalGain: GainNode,
    id: string,
    track: Track,
    shuffle: boolean,
    repeatMode: RepeatMode,
    onLoad?: (track: { audioObject: AudioObject, audioElements: AudioElements }) => void,
    onError?: (e: MediaError) => void,
    onEnd?: () => void,
): { audioObject: AudioObject, audioElements: AudioElements } {
    const gainNode = context.createGain();
    gainNode.gain.setValueAtTime(1, 0);
    const audio = new Audio(track.source!);
    const source = context.createMediaElementSource(audio);
    audio.crossOrigin = "anonymous";

    const trueOnError = onError ? () => onError(audio.error!) : undefined;
    if (onError && trueOnError) {
        audio.addEventListener("error", trueOnError, { once: true });
    }

    if (onEnd) {
        audio.addEventListener(
            "ended",
            onEnd
        );
    }

    const trueOnLoad = onLoad ? () => onLoad({
        audioObject: {
            id,
            track,
            shuffle,
            repeatMode,
            updateCount: 0,
        },
        audioElements: {
            context,
            gain: gainNode,
            audio,
            source,
            onLoad: trueOnLoad,
            onError: trueOnError,
            onEnd,
        }
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
    source.connect(gainNode).connect(globalGain);

    return {
        audioObject: {
            id,
            track,
            shuffle,
            repeatMode,
            updateCount: 0,
        },
        audioElements: {
            context,
            gain: gainNode,
            audio,
            source,
            onLoad: trueOnLoad,
            onError: trueOnError,
            onEnd,
        }
    };
}

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
    const { tracks, shuffledTracks, loadOnlineTrack } = useTracks();
    const { sendMessage } = useOBRBroadcast<MessageContent>();
    const audioContextRef = useRef(new AudioContext());
    const globalGainRef = useRef<GainNode>();
    const audioElementsRef = useRef<Record<string, AudioElements>>({});
    const [playing, setPlaying] = useState<Record<string, AudioObject|null>>({});
    const [volume, setVolume] = useState(1);
    const [triggeredEventCount, setTriggeredEventCount] = useState(0);

    useEffect(() => {
        const context = audioContextRef.current;
        const gain = context.createGain();
        gain.gain.setValueAtTime(1, 0);
        globalGainRef.current = gain;
        gain.connect(context.destination);

        function handleStateChange() {
            if (context.state == "suspended") {
                logging.warn("Audio Context was suspended, resuming");
                context.resume();
            }
            else if (context.state == "closed") {
                logging.error("Audio Context has closed unexpectedly");
            }
        }
        if (context.state == "suspended") {
            context.resume();
        }
        context.addEventListener("statechange", handleStateChange);

        return () => {
            gain.disconnect();
            context.removeEventListener("statechange", handleStateChange);
        }
    }, []);

    useEffect(() => {
        if (globalGainRef.current == undefined) return;
        const now = audioContextRef.current.currentTime;
        globalGainRef.current.gain.cancelScheduledValues(now);
        globalGainRef.current.gain.setValueAtTime(volume, now);
    }, [volume]);

    useEffect(() => {
        sendMessage(
            INTERNAL_BROADCAST_CHANNEL,
            { 
                type: "playing",
                payload: { 
                    playing: Object.entries(playing).map(([playlist, track]) => {
                        const audioElement = audioElementsRef.current[playlist];
                        return {
                            playlist,
                            id: (track?.track?.id ? String(track?.track?.id) : undefined) as string,
                            name: track?.track?.name as string,
                            source: audioElement?.audio?.src,
                            playing: !(audioElement?.audio?.paused ?? true),
                            position: audioElement?.audio?.currentTime ?? 0,
                            volume: audioElement?.gain?.gain?.value,
                        };
                    }).filter(track => track.source != undefined && track.name != undefined && track.id != undefined)
                } 
            },
            undefined,
            "ALL"
        );
    }, [playing, sendMessage, triggeredEventCount]);

    const triggerEvent = useCallback(() => {
        setTriggeredEventCount(old => old + 1);
    }, []);

    const getNextTrack = useCallback((id: string, respectRepeatMode: boolean = false) => {
        const current = playing[id];
        if (current == undefined) return null;

        if (respectRepeatMode && current.repeatMode == "no-repeat") {
            return null;
        }
        if (respectRepeatMode && current.repeatMode == "repeat-self") {
            return current.track;
        }

        const actualTracks = (current.shuffle ? shuffledTracks : tracks).get(id);
        if (actualTracks == undefined) return null;

        const index = actualTracks.findIndex(track => track.id.toString() === current.id);
        if (index == -1) return null;
        
        const nextIndex = mod(index + 1, actualTracks.length);
        return actualTracks[nextIndex];
    }, [playing, shuffledTracks, tracks]);

    const getPreviousTrack = useCallback((id: string) => {
        const current = playing[id];
        if (current == undefined) return null;

        const actualTracks = (current.shuffle ? shuffledTracks : tracks).get(id);
        if (actualTracks == undefined) return null;

        const index = actualTracks.findIndex(track => track.id.toString() === current.id);
        if (index == -1) return null;
        
        const prevIndex = mod(index - 1, actualTracks.length);
        return actualTracks[prevIndex];
    }, [playing, shuffledTracks, tracks]);

    useEffect(() => {
        for (const channel of Object.keys(audioElementsRef.current)) {
            audioElementsRef.current[channel].nextTrack = getNextTrack(channel, true) ?? undefined;
        }
    }, [getNextTrack]);

    const unloadTrack = useCallback((id: string) => {
        setPlaying(prev => {
            const track = prev[id];
            if (!track) {
                logging.warn("Tried to unload an already unloaded source.");
                return prev;
            }
            const audioElements = audioElementsRef.current[id];
            if (audioElements == undefined) {
                logging.warn("No audio elements found when unloading track.");
            }
            else {
                cleanupAudioNodes(audioElements);
                delete audioElementsRef.current[id];
            }
            const next = { ...prev };
            delete next[id];
            return next;
        });
    }, []);

    const loadTrack = useCallback((id: string, url: string, name: string, trackId?: string, shuffle?: boolean, repeatMode?: RepeatMode): Promise<{ audioObject: AudioObject, audioElements: AudioElements }> => {
        return new Promise((resolve, reject) => {
            setPlaying(prev => {
                if (globalGainRef.current == undefined) {
                    reject(new Error("Tried to load track before setup was complete"));
                    return prev;
                }

                const previousAudioElements = audioElementsRef.current[id];                
                const track = prev[id];
                const originalTrack = (tracks.get(id) ?? []).find(t => t.id.toString() == trackId);
                if (previousAudioElements != undefined) {
                    cleanupAudioNodes(previousAudioElements);
                }

                trackId = trackId ?? uuid();
                const { audioObject: newTrack, audioElements } = setupAudioNodes(
                    audioContextRef.current,
                    globalGainRef.current,
                    trackId,
                    {
                        id: (originalTrack ? originalTrack.id : undefined) as number, //FIXME: this might cause problems
                        name: originalTrack ? originalTrack.name : name,
                        source: originalTrack ? originalTrack.source : url,
                        source_expiration: originalTrack ? originalTrack.source_expiration : null,
                        size: originalTrack ? originalTrack.size : 0,
                    },
                    shuffle ?? track?.shuffle ?? false,
                    repeatMode ?? track?.repeatMode ?? "repeat-all",
                    loadedTrack => {
                        if (previousAudioElements?.audio != undefined) {
                            loadedTrack.audioElements.gain.gain.setValueAtTime(previousAudioElements.gain.gain.value, 0);
                            audioContextRef.current.resume().then(() => loadedTrack.audioElements.audio.play());
                        }
                        resolve(loadedTrack);
                        triggerEvent();
                    },
                    err => reject(err ?? new Error("Audio failed to load")),
                    () => {
                        const elements = audioElementsRef.current[id];
                        if (elements == undefined) {
                            logging.warn(`Track elements for ${trackId} were removed before processing onEnd()`);
                            return;   
                        }
                        if (elements.nextTrack == undefined) {
                            setPlaying(prev => (prev[id] == undefined ? prev : {
                                ...prev, 
                                [id]: {...prev[id], updateCount: prev[id].updateCount+1 }
                            }));
                            return;
                        }
                        loadOnlineTrack(elements.nextTrack).then(nextTrack => {
                            loadTrack(id, nextTrack.source!, nextTrack.name, nextTrack.id?.toString?.());
                        });
                    }
                );
                audioElementsRef.current[id] = audioElements;
                return {
                    ...prev,
                    [id]: newTrack,
                };
            });
        });
    }, [loadOnlineTrack, tracks, triggerEvent]);

    const updateTrack = useCallback((id: string, trackId: string, shuffle?: boolean, repeatMode?: RepeatMode) => {
        setPlaying(prev => {            
            const track = prev[id]; 
            if (track == undefined) {
                logging.warn(`Tried to update an unknown track (${trackId} in channel ${id})`);
                return prev;
            }
            track.updateCount++;
            
            if (shuffle != undefined) {
                track.shuffle = shuffle;
            }
            if (repeatMode != undefined) {
                track.repeatMode = repeatMode;
            }
            
            return {
                ...prev,
                [id]: track,
            };
        });  
    }, []);

    const getTrack = useCallback((id: string) => {
        return playing[id];
    }, [playing]);

    const getTrackElements = useCallback((id: string) => {
        return audioElementsRef.current[id];
    }, []);

    const fadeInTrack = useCallback((channel: string, duration: number): Promise<void> => {
        sendMessage(
            INTERNAL_BROADCAST_CHANNEL,
            {
                type: "fade",
                payload: {
                    playlist: channel,
                    fade: "in",
                    duration: duration,
                }
            },
            undefined,
            "REMOTE"
        );
        return new Promise((resolve, reject) => {
            const trackElements = audioElementsRef.current[channel];
            if (!trackElements) {
                const error = new Error("Fade-in failed: no audio track to fade");
                reject(error);
                return;
            }

            const context = trackElements.gain.context;
            const now = context.currentTime;

            const originalVolume = trackElements.gain.gain.value;
            trackElements.gain.gain.cancelScheduledValues(now);
            trackElements.gain.gain.setValueAtTime(0, now);
            trackElements.audio.play().then(() => {
                trackElements.gain.gain.linearRampToValueAtTime(originalVolume, now + duration / 1000);
                setTimeout(() => {
                    resolve();
                }, duration);
            }).catch(error => {
                reject(error);
            }).finally(triggerEvent);
        });
    }, [triggerEvent, sendMessage]);

    const fadeOutTrack = useCallback((channel: string, duration: number): Promise<void> => {
        sendMessage(
            INTERNAL_BROADCAST_CHANNEL,
            {
                type: "fade",
                payload: {
                    playlist: channel,
                    fade: "out",
                    duration: duration,
                }
            },
            undefined,
            "REMOTE"
        );
        return new Promise((resolve, reject) => {
            const trackElements = audioElementsRef.current[channel];
            if (!trackElements) {
                const error = new Error("Fade-out failed: no audio track to fade");
                reject(error);
                return;
            }

            const context = trackElements.gain.context;
            const now = context.currentTime;

            const originalVolume = trackElements.gain.gain.value;
            trackElements.gain.gain.cancelScheduledValues(now);
            trackElements.gain.gain.linearRampToValueAtTime(0, now + duration / 1000);
        
            setTimeout(() => {
                resolve();
                trackElements.audio.pause();
                trackElements.gain.gain.setValueAtTime(originalVolume, now);
                triggerEvent();
            }, duration);
        });
    }, [triggerEvent, sendMessage]);

    return <AudioPlayerContext.Provider
        value={{
            playing,
            getTrack,
            getTrackElements,
            unloadTrack,
            loadTrack,
            updateTrack,
            setVolume,
            getNextTrack,
            getPreviousTrack,
            volume,
            fadeInTrack,
            fadeOutTrack,
            triggerEvent,
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

export function useAudioControls(channel: string): AudioPlayerControls {
    const {
        loadTrack,
        updateTrack,
        getTrack,
        getTrackElements,
        getNextTrack,
        getPreviousTrack,
        triggerEvent,
        fadeInTrack,
        fadeOutTrack,
    } = useAudio();
    const throttledTriggerEvent = useThrottled(triggerEvent, 100, "trailing");
    const { loadOnlineTrack } = useTracks();
    const [id, setId] = useState<string|null>(null);
    const [src, setSrc] = useState<string|null>(null);
    const [playing, setPlaying] = useState(false);
    const [volume, _setVolume] = useState(1);
    const [shuffle, _setShuffle] = useState<boolean>(false);
    const [repeatMode, _setRepeatMode] = useState<RepeatMode>("repeat-all");
    const [loaded, setLoaded] = useState(false);
    const [duration, setDuration] = useState<number|null>(null);
    const [position, setPosition] = useState<number|null>(null);
    const [name, setName] = useState<string|null>(null);
    const [error, setError] = useState<Error|MediaError|null>(null);
    
    useEffect(() => {
        let raf: number;
        const trackElements = getTrackElements(channel);
        if (!trackElements) return;

        const updatePosition = () => {
            setPosition(trackElements.audio.currentTime);
            if (!isNaN(trackElements.audio.duration)) {
                setDuration(trackElements.audio.duration);
            }
            raf = requestAnimationFrame(updatePosition);
        };

        raf = requestAnimationFrame(updatePosition);

        return () => {
            cancelAnimationFrame(raf);
        };
    }, [channel, getTrackElements, getTrack, id]);

    useEffect(() => {
        const track = getTrack(channel);
        const trackElements = getTrackElements(channel);
        if (!trackElements || !track) return;
        setId(track.id);
        setSrc(trackElements.audio.src);
        setName(track.track.name);
        setError(trackElements.audio.error);
        _setVolume(prev => prev == 1 ? trackElements.gain.gain.value : prev);
        _setShuffle(track.shuffle);
        _setRepeatMode(track.repeatMode);
        if (trackElements.audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
            setDuration(trackElements.audio.duration);
        }
        if (trackElements.audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
            setLoaded(true);
            setPosition(trackElements.audio.currentTime);
            setPlaying(!trackElements.audio.paused);
        }
    }, [channel, updateTrack, getTrack, getTrackElements, id]);

    const load = useCallback(async (src: string, name: string, id?: string) => {
        if (src == undefined) return;
        logging.info(`[CHANNEL ${channel}] Loading track "${name}"`);
        const trackId = id ?? uuid();
        setLoaded(false);
        setId(trackId);
        setSrc(src);
        setName(name);
        setPosition(0);
        setError(null);
        try {
            const track = await loadTrack(channel, src, name, trackId, shuffle, repeatMode);
            setLoaded(true);
            setDuration(track.audioElements.audio.duration);
            if (playing) {
                await track.audioElements.audio.play();
            }
        } catch (error) {
            setError(error as MediaError);
            throw error;
        } finally {
            triggerEvent();
        }
    }, [channel, shuffle, repeatMode, playing, loadTrack, triggerEvent]);

    const reload = useCallback(async () => {
        if (src == undefined) return;
        logging.info(`[CHANNEL ${channel}] Reloading track from "${name}"`);
        setLoaded(false);
        setPlaying(false);
        setPosition(0);
        setError(null);
        try {
            const track = await loadTrack(channel, src, name ?? "N/A", id!, shuffle, repeatMode);
            setLoaded(true);
            setDuration(track.audioElements.audio.duration);
            if (playing) {
                await track.audioElements.audio.play();
            }
        } catch (error) {
            setError(error as MediaError);
            throw error;
        } finally {
            triggerEvent();
        }
    }, [channel, id, shuffle, repeatMode, playing, loadTrack, src, name, triggerEvent]);

    const play = useCallback(async () => {
        const trackElements = getTrackElements(channel);
        if (!trackElements) return;
        try {
            await trackElements.audio.play();
            setPlaying(true);
        }
        catch (error) {
            setError(error as MediaError);
            throw error;   
        } finally {
            triggerEvent();
        }
    }, [channel, getTrackElements, triggerEvent]);

    const pause = useCallback(() => {
        const trackElements = getTrackElements(channel);
        if (!trackElements) return;
        trackElements.audio.pause();
        setPlaying(false);
        triggerEvent();
    }, [channel, getTrackElements, triggerEvent]);

    const fadeIn = useCallback(async (duration: number): Promise<void> => {
        try {
            await fadeInTrack(channel, duration);
            setPlaying(true);
        }
        catch (error) {
            setError(error as Error);
        }
    }, [channel, fadeInTrack]);

    const fadeOut = useCallback(async (duration: number): Promise<void> => {
        try {
            await fadeOutTrack(channel, duration);
            setPlaying(false);
        }
        catch (error) {
            setError(error as Error);
        }
    }, [channel, fadeOutTrack]);

    const setVolume = useCallback((volume: number) => {
        const trackElements = getTrackElements(channel);
        if (!trackElements) return;

        const context = trackElements.gain.context;
        const now = context.currentTime;
        trackElements.gain.gain.setValueAtTime(volume, now);
        _setVolume(volume);
        throttledTriggerEvent();
    }, [channel, getTrackElements, throttledTriggerEvent]);

    const setShuffle = useCallback((shuffle: boolean) => {
        const track = getTrack(channel);
        if (!track) return;

        updateTrack(channel, track.id, shuffle, track.repeatMode);
        _setShuffle(shuffle);
    }, [channel, getTrack, updateTrack]);

    const setRepeatMode = useCallback((repeatMode: RepeatMode) => {
        const track = getTrack(channel);
        if (!track) return;

        updateTrack(channel, track.id, track.shuffle, repeatMode);
        _setRepeatMode(repeatMode);
    }, [channel, getTrack, updateTrack]);

    const seek = useCallback((time: number) => {
        const trackElements = getTrackElements(channel);
        if (trackElements == undefined) return;

        setPosition(time);
        trackElements.audio.currentTime = time;
        triggerEvent();
    }, [channel, getTrackElements, triggerEvent]);

    const next = useCallback(async () => {        
        const nextTrack = getNextTrack(channel);
        if (nextTrack == null) return;
        const updatedTrack = await loadOnlineTrack(nextTrack);
        return await load(updatedTrack.source!, updatedTrack.name, updatedTrack.id?.toString?.() ?? uuid());
    }, [channel, getNextTrack, load, loadOnlineTrack]);

    const prev = useCallback(async () => {
        const prevTrack = getPreviousTrack(channel);
        if (prevTrack == null) return;
        const updatedTrack = await loadOnlineTrack(prevTrack);
        return await load(updatedTrack.source!, updatedTrack.name, updatedTrack.id?.toString?.() ?? uuid());
    }, [channel, getPreviousTrack, load, loadOnlineTrack]);

    return useMemo(() => ({
        id,
        src,
        name,
        playing,
        volume,
        loaded,
        duration,
        shuffle,
        repeatMode,
        error,
        load,
        reload,
        play,
        pause,
        setVolume,
        setShuffle,
        setRepeatMode,
        position,
        fadeIn,
        fadeOut,
        seek,
        next,
        prev,
    }), [
        id,
        src,
        name,
        playing,
        volume,
        loaded,
        duration,
        shuffle,
        repeatMode,
        error,
        load,
        play,
        pause,
        position,
        fadeIn,
        fadeOut,
        seek,
        reload,
        setVolume,
        setShuffle,
        setRepeatMode,
        next,
        prev,
    ]);
}
