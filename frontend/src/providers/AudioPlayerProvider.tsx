/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { RepeatMode } from "../types/tracks";
import { logging } from "../logging";
import uniqueId from "lodash/uniqueId";
import { useTracks } from "./TrackProvider";

export interface AudioElements {
    gain: GainNode;
    audio: HTMLAudioElement;
    source: MediaElementAudioSourceNode;
    onEnd?: () => void;
    onLoad?: () => void;
    onError?: (err: ErrorEvent) => void;
}

export interface AudioObject {
    id: string;
    sourceURL: string;
    name: string;
    shuffle: boolean;
    repeatMode: RepeatMode;
}

interface GlobalAudioContextType {
    volume: number;
    playing: Record<string, AudioObject|null>;

    unloadTrack: (id: string) => void;
    loadTrack: (id: string, url: string, name: string, trackId?: string, shuffle?: boolean, repeatMode?: RepeatMode) => Promise<{ audioObject: AudioObject, audioElements: AudioElements }>;
    getTrack: (id: string) => AudioObject|null|undefined;
    getTrackElements: (id: string) => AudioElements|undefined;
    setVolume: (volume: number) => void;
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
    trackIndex: number | null;
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

    elements.audio.src = "";
    elements.audio.load();
    elements.source.disconnect();
    elements.gain.disconnect();
}

function setupAudioNodes(
    context: AudioContext,
    globalGain: GainNode,
    trackId: string,
    url: string,
    name: string,
    shuffle: boolean,
    repeatMode: RepeatMode,
    onLoad?: (track: { audioObject: AudioObject, audioElements: AudioElements }) => void,
    onError?: (e: MediaError) => void
): { audioObject: AudioObject, audioElements: AudioElements } {
    const gainNode = context.createGain();
    gainNode.gain.setValueAtTime(1, 0);
    const audio = new Audio(url);
    const source = context.createMediaElementSource(audio);
    audio.crossOrigin = "anonymous";

    const trueOnError = onError ? () => onError(audio.error!) : undefined;
    if (onError && trueOnError) {
        audio.addEventListener("error", trueOnError);
    }

    const trueOnLoad = onLoad ? () => onLoad({
        audioObject: {
            id: trackId,
            sourceURL: url,
            name,
            shuffle,
            repeatMode,
        },
        audioElements: {
            gain: gainNode,
            audio,
            source,
            onLoad: trueOnLoad,
            onError: trueOnError,
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
            id: trackId,
            sourceURL: url,
            name,
            shuffle,
            repeatMode,
        },
        audioElements: {
            gain: gainNode,
            audio,
            source,
            onLoad: trueOnLoad,
            onError: trueOnError,
        }
    };
}

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
    const audioContextRef = useRef(new AudioContext());
    const globalGainRef = useRef<GainNode>();
    const audioElementsRef = useRef<Record<string, AudioElements>>({});
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
                if (track == undefined || (track.id !== trackId && track.sourceURL !== url)) {
                    if (previousAudioElements != undefined) {
                        cleanupAudioNodes(previousAudioElements);
                    }

                    const { audioObject: newTrack, audioElements } = setupAudioNodes(
                        audioContextRef.current,
                        globalGainRef.current,
                        trackId ?? uuid(),
                        url,
                        name,
                        shuffle ?? false,
                        repeatMode ?? "repeat-all",
                        track => { logging.info("Track loaded:", track); resolve(track); },
                        err => { reject(err ?? new Error("Audio failed to load")); },
                    );
                    audioElementsRef.current[id] = audioElements;
                    return {
                        ...prev,
                        [id]: newTrack,
                    };
                }
                else {
                    const newTrack = track;
                    newTrack.name = name;
                    newTrack.shuffle = shuffle ?? false;
                    newTrack.repeatMode = repeatMode ?? "repeat-all";
                    resolve({ audioObject: newTrack, audioElements: audioElementsRef.current[id]});
                    return {
                        ...prev,
                        [id]: newTrack,
                    };
                }
            });
        });
    }, []);

    const getTrack = useCallback((id: string) => {
        return playing[id];
    }, [playing]);

    const getTrackElements = useCallback((id: string) => {
        return audioElementsRef.current[id];
    }, []);

    return <AudioPlayerContext.Provider
        value={{
            playing,
            getTrack,
            getTrackElements,
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

export function useAudioControls(channel: string): AudioPlayerControls {
    const {
        loadTrack,
        getTrack,
        getTrackElements,
    } = useAudio();
    const { tracks: _tracks, shuffledTracks: _shuffledTracks, loadOnlineTrack } = useTracks();
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
    const [trackIndex, setTrackIndex] = useState<number|null>(null);

    const tracks = useMemo(() => {
        return _tracks.get(channel) ?? [];
    }, [_tracks, channel]);
    const shuffledTracks = useMemo(() => {
        return _shuffledTracks.get(channel) ?? [];
    }, [_shuffledTracks, channel]);

    useEffect(() => {
        let raf: number;
        const trackElements = getTrackElements(channel);
        if (!trackElements) return;

        const updatePosition = () => {
            setPosition(trackElements.audio.currentTime);
            raf = requestAnimationFrame(updatePosition);
        };

        raf = requestAnimationFrame(updatePosition);

        return () => {
            cancelAnimationFrame(raf);
        };
    }, [channel, getTrackElements]);

    useEffect(() => {
        const track = getTrack(channel);
        const trackElements = getTrackElements(channel);
        if (!trackElements || !track) return;
        setId(track.id);
        setSrc(trackElements.audio.src);
        setName(track.name);
        setError(trackElements.audio.error);
        _setVolume(trackElements.gain.gain.value);
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
    }, [channel, getTrack, getTrackElements]);

    useEffect(() => {
        if (shuffle) {
            const index = shuffledTracks.findIndex(track => track.id.toString() == id);
            setTrackIndex(
                index == -1 ? null : index
            );
        }
        else {
            const index = tracks.findIndex(track => track.id.toString() == id);
            setTrackIndex(
                index == -1 ? null : index
            );
        }
    }, [id, shuffle, shuffledTracks, tracks]);

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
            const track = await loadTrack(channel, src, name, trackId);
            setLoaded(true);
            setDuration(track.audioElements.audio.duration);
        } catch (error) {
            setError(error as MediaError);
            throw error;
        }
    }, [channel, loadTrack]);

    const reload = useCallback(async () => {
        if (src == undefined) return;
        logging.info(`[CHANNEL ${channel}] Reloading track from "${name}"`);
        setLoaded(false);
        setPlaying(false);
        setPosition(0);
        setError(null);
        try {
            const track = await loadTrack(channel, src, name ?? "N/A");
            setLoaded(true);
            setDuration(track.audioElements.audio.duration);
        } catch (error) {
            setError(error as MediaError);
            throw error;
        }
    }, [channel, loadTrack, src, name]);

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
        }
    }, [channel, getTrackElements]);

    const pause = useCallback(() => {
        const trackElements = getTrackElements(channel);
        if (!trackElements) return;
        trackElements.audio.pause();
        setPlaying(false);
    }, [channel, getTrackElements]);

    const fadeIn = useCallback((duration: number): Promise<void> => {
        return new Promise((resolve, reject) => {
            const trackElements = getTrackElements(channel);
            if (!trackElements) {
                const error = new Error("Fade-in failed: no audio track to fade");
                setError(error);
                reject(error);
                return;
            }

            logging.info(`[CHANNEL ${channel}] Fading in...`);
            const context = trackElements.gain.context;
            const now = context.currentTime;

            trackElements.gain.gain.cancelScheduledValues(now);
            trackElements.gain.gain.setValueAtTime(0, now);
            trackElements.audio.play().then(() => {
                setPlaying(true);
                trackElements.gain.gain.linearRampToValueAtTime(1, now + duration / 1000);
                setTimeout(() => {
                    resolve();
                }, duration);
            }).catch(error => {
                setError(error);
                reject(error);
            });
        });
    }, [channel, getTrackElements]);

    const fadeOut = useCallback((duration: number): Promise<void> => {
        return new Promise((resolve, reject) => {
            const trackElements = getTrackElements(channel);
            if (!trackElements) {
                const error = new Error("Fade-out failed: no audio track to fade");
                setError(error);
                reject(error);
                return;
            }

            const context = trackElements.gain.context;
            const now = context.currentTime;

            logging.info(`[CHANNEL ${channel}] Fading out...`);
            trackElements.gain.gain.cancelScheduledValues(now);
            trackElements.gain.gain.linearRampToValueAtTime(0, now + duration / 1000);
        
            setTimeout(() => {
                resolve();
                setPlaying(false);
                trackElements.audio.pause();
            }, duration);
        });
    }, [channel, getTrackElements]);

    const setVolume = useCallback((volume: number) => {
        const trackElements = getTrackElements(channel);
        if (!trackElements) return;

        const context = trackElements.gain.context;
        const now = context.currentTime;
        trackElements.gain.gain.setValueAtTime(volume, now);
        _setVolume(volume);
    }, [channel, getTrackElements]);

    const setShuffle = useCallback((shuffle: boolean) => {
        const track = getTrack(channel);
        if (!track) return;

        loadTrack(channel, track.sourceURL, track.name, track.id, shuffle, track.repeatMode);
        _setShuffle(shuffle);
    }, [channel, getTrack, loadTrack]);

    const setRepeatMode = useCallback((repeatMode: RepeatMode) => {
        const track = getTrack(channel);
        if (!track) return;

        loadTrack(channel, track.sourceURL, track.name, track.id, track.shuffle, repeatMode);
        _setRepeatMode(repeatMode);
    }, [channel, getTrack, loadTrack]);

    const seek = useCallback((time: number) => {
        const trackElements = getTrackElements(channel);
        if (trackElements == undefined) return;

        trackElements.audio.currentTime = time;
    }, [channel, getTrackElements]);

    const next = useCallback(async () => {
        if (trackIndex == null) return;
        
        const actualTracks = shuffle ? shuffledTracks : tracks;
        const nextTrackIndex = mod((trackIndex + 1), actualTracks.length);
        const nextTrack = actualTracks[nextTrackIndex];
        const updatedTrack = await loadOnlineTrack(nextTrack);
        return await load(updatedTrack.source!, updatedTrack.name, updatedTrack.id?.toString?.() ?? uuid());
    }, [shuffle, shuffledTracks, tracks, trackIndex, load, loadOnlineTrack]);

    const prev = useCallback(async () => {
        if (trackIndex == null) return;

        const actualTracks = shuffle ? shuffledTracks : tracks;
        const nextTrackIndex = mod((trackIndex - 1), actualTracks.length);
        const nextTrack = actualTracks[nextTrackIndex];
        console.log(nextTrackIndex, nextTrack);
        const updatedTrack = await loadOnlineTrack(nextTrack);
        return await load(updatedTrack.source!, updatedTrack.name, updatedTrack.id?.toString?.() ?? uuid());
    }, [shuffle, shuffledTracks, tracks, trackIndex, load, loadOnlineTrack]);

    return useMemo(() => ({
        id,
        src,
        name,
        playing,
        volume,
        loaded,
        duration,
        trackIndex,
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
        trackIndex,
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
