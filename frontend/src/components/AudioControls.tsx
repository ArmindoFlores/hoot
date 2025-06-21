import { Box, Card, CircularProgress, IconButton, Slider, Typography } from "@mui/material";
import { Track, useTracks } from "./TrackProvider";
import { faBackward, faCircleExclamation, faClose, faForward, faPause, faPlay, faRepeat, faShuffle, faVolumeHigh, faVolumeLow, faVolumeOff } from "@fortawesome/free-solid-svg-icons";
import { fadeInVolume, fadeOutVolume } from "../utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { APP_KEY } from "../config";
import FadeIn from "../assets/fadein.svg";
import FadeOut from "../assets/fadeout.svg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { MessageContent } from "../types/messages";
import OBR from "@owlbear-rodeo/sdk";
import RepeatSelf from "../assets/repeat-self.svg";
import { useAudioPlayer } from "./AudioPlayerProvider";
import { useOBRBroadcast } from "../hooks/obr";
import { useSettings } from "./SettingsProvider";
import { useThrottled } from "../hooks";

export interface AudioControlsProps {
    playlist: string;
}

function formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const formattedMinutes = minutes.toString().padStart(2, "0");
    const formattedSeconds = Math.floor(secs).toString().padStart(2, "0");

    if (hours > 0) {
        const formattedHours = hours.toString().padStart(2, "0");
        return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
    } else {
        return `${formattedMinutes}:${formattedSeconds}`;
    }
}

function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) { 
        const j = Math.floor(Math.random() * (i + 1)); 
        [array[i], array[j]] = [array[j], array[i]]; 
    } 
    return array; 
}

async function tryPlay(audio: HTMLAudioElement, trackName: string) {
    try {
        await audio.play();
        return true;
    }
    catch (error) {
        const domError = error as DOMException;
        if (domError.name === "NotAllowedError") {
            // Autoplay issue
            OBR.notification.show(`Could not start the track '${trackName}' because autoplay is disabled`, "WARNING");
        }
        else if (domError.name === "AbortError") {
            // This is not really an error for us
        }
        else {
            // Some other issue
            OBR.notification.show(`Error starting track '${trackName}': ${domError.message}`, "ERROR");
        }
    }
    return false;
}

export function AudioControls(props: AudioControlsProps) {
    const { 
        volume, 
        playing, 
        setTrack,
        setVolume,
        setPlaybackTime,
        setDuration,
        setShuffle,
        setIsPlaying,
        setLoaded,
        setRepeatMode
    } = useAudioPlayer();
    const { fadeTime } = useSettings();
    const { tracks } = useTracks();
    const { sendMessage, registerMessageHandler } = useOBRBroadcast<MessageContent>();

    const current = useMemo(() => playing[props.playlist], [playing, props.playlist]);
    const audioRef = useRef<HTMLAudioElement>(null);
    
    const [ shuffled, setShuffled ] = useState<typeof tracks>(new Map());
    const [ loaded, setTrackLoaded ] = useState(false);
    const [ scheduledUpdate, setScheduledUpdate ] = useState(false);
    const [ fading, setFading ] = useState(false);
    const [ errored, setErrored] = useState(false);
    const [ errorMessage, setErrorMessage] = useState("");

    const throttledSend = useThrottled(sendMessage, 250, "trailing");

    const sendTrackUpdates = () => {
        setScheduledUpdate(true);
    }

    const setCurrentTrack = useCallback((track?: Track) => {
        setTrack(track, props.playlist);
        sendTrackUpdates();
    }, [props.playlist, setTrack]);
    
    const setAudioTime = useCallback((time: number) => {
        const audioElement = audioRef.current;
        if (audioElement) {
            audioElement.currentTime = time;
            setPlaybackTime(audioElement.currentTime, props.playlist);
            sendTrackUpdates();
        }
    }, [props.playlist, setPlaybackTime]);

    const nextRepeatMode = () => {
        if (current.repeatMode === "no-repeat") {
            setRepeatMode("repeat-all", props.playlist);
        }
        else if (current.repeatMode === "repeat-all") {
            setRepeatMode("repeat-self", props.playlist);
        }
        else {
            setRepeatMode("no-repeat", props.playlist);
        }
    }

    const changeTrack = useCallback((offset: number) => {
        if (fading) return;
        const playlistTracks = (current.shuffle ? shuffled : tracks).get(props.playlist)!;
        const currentIndex = playlistTracks.findIndex(track => track.name === current.track.name);
        const nextIndex = (currentIndex + offset) % playlistTracks.length;
        setCurrentTrack(playlistTracks[nextIndex]);
        setAudioTime(0);
        sendTrackUpdates();
    }, [current.shuffle, current.track?.name, fading, props.playlist, setAudioTime, setCurrentTrack, shuffled, tracks]);

    const handleAudioError = useCallback(() => {
        OBR.notification.show(`Error loading track '${current.track.name}': ${audioRef.current?.error?.message}`, "ERROR");
        setErrored(true);
        setErrorMessage(`Error loading track (${audioRef.current?.error?.message})`);
    }, [current.track?.name]);

    const handleAudioLoaded = useCallback(() => {
        setTrackLoaded(true); 
        setLoaded(true, props.playlist);
        setErrored(false);
    }, [props.playlist, setLoaded]);

    const handleFadeIn = useCallback(async () => {
        const audio = audioRef.current;
        if (fading || current.playing || current.volume <= 0 || audio == undefined) return;
        
        setFading(true);
        const playResult = tryPlay(audio, current.track.name);
        if (!playResult) {
            setFading(false);
            return;
        }
        
        audio.volume = 0;
        sendMessage(`${APP_KEY}/internal`, { type: "fade", payload: { playlist: props.playlist, fade: "in", duration: fadeTime }});
        setIsPlaying(true, props.playlist);

        const targetVolume = current.volume;
        const interval = 50;
        const steps = fadeTime / interval;

        let currentStep = 0;

        const fadeAudio = setInterval(() => {
            if (currentStep < steps) {
                audio.volume = fadeInVolume(targetVolume, currentStep, steps) * volume;
                currentStep++;
            } else {
                clearInterval(fadeAudio);
                setFading(false);
            }
        }, interval);
    }, [fading, current.playing, current.volume, fadeTime, sendMessage, setIsPlaying, volume, props.playlist, current.track?.name]);

    const handleFadeOut = useCallback(() => {
        const audio = audioRef.current;
        if (fading || !current.playing || current.volume <= 0 || audio == undefined) return;
        
        setFading(true);
        sendMessage(`${APP_KEY}/internal`, { type: "fade", payload: { playlist: props.playlist, fade: "out", duration: fadeTime } });

        const initialVolume = current.volume;
        const interval = 50;
        const steps = fadeTime / interval;

        let currentStep = 0;

        const fadeAudio = setInterval(() => {
            if (currentStep <= steps) {
                audio.volume = fadeOutVolume(initialVolume, currentStep, steps) * volume;
                currentStep++;
            } else {
                audio.pause();
                setIsPlaying(false, props.playlist);
                clearInterval(fadeAudio);
                setFading(false);
            }
        }, interval);
    }, [fading, current.playing, current.volume, fadeTime, props.playlist, sendMessage, setIsPlaying, volume]);

    useEffect(() => {
        if (scheduledUpdate) {
            setScheduledUpdate(false);
            throttledSend(
                `${APP_KEY}/internal`,
                {
                    type: "track",
                    payload:  {
                        playlist: props.playlist,
                        name: current.track.name,
                        source: current.track.source,
                        time: current.time,
                        volume: current.volume,
                        playing: current.playing,
                    }
                }
            );
        }
    }, [scheduledUpdate, throttledSend, current, props.playlist]);

    useEffect(() => {
        const newShuffled = new Map<string, Track[]>();
        for (const playlist of tracks.keys()) {
            newShuffled.set(playlist, shuffleArray([...tracks.get(playlist)!]));
        }
        setShuffled(newShuffled);
    }, [tracks]);

    useEffect(() => {
        const audioElement = audioRef.current;
        if (audioElement) {
            const handleTimeUpdate = () => {
                setPlaybackTime(audioElement.currentTime, props.playlist);
            };
            const handleEnded = () => {
                if (current.repeatMode === "no-repeat") {
                    setIsPlaying(false, props.playlist);
                    setAudioTime(0);
                }
                else if (current.repeatMode === "repeat-self") {
                    setAudioTime(0);
                    tryPlay(audioElement, current.track.name);
                }
                else {
                    changeTrack(+1);
                }
                sendTrackUpdates();
            }

            audioElement.addEventListener("timeupdate", handleTimeUpdate);
            audioElement.addEventListener("ended", handleEnded);

            return () => {
                audioElement.removeEventListener("timeupdate", handleTimeUpdate);
                audioElement.removeEventListener("ended", handleEnded);
            };
        }
    }, [changeTrack, current.repeatMode, current.shuffle, current.track?.name, props.playlist, setAudioTime, setIsPlaying, setPlaybackTime, tracks]);

    useEffect(() => {
        setLoaded(false, props.playlist);
        setTrackLoaded(false);
    }, [current.track?.name, props.playlist, setLoaded]);

    useEffect(() => {
        const audioElement = audioRef.current;
        if (!fading && audioElement != undefined && current.volume) {
            audioElement.volume = current.volume * volume;
            sendTrackUpdates();
        }
    }, [current.volume, volume, fading])

    useEffect(() => {
        const audioElement = audioRef.current;
        if (loaded && !fading && audioElement != undefined) {
            if (current.playing) {
                tryPlay(audioElement, current.track.name)
            }
            else {
                audioElement.pause();
            }
            sendTrackUpdates();
        }
    }, [current.playing, loaded, fading, current.track?.name]);

    useEffect(() => {
        const audioElement = audioRef.current;
        if (loaded && audioElement) {
            setDuration(audioElement.duration, props.playlist);
            setPlaybackTime(0, props.playlist);
            sendTrackUpdates();
        }
    }, [loaded, props.playlist, setDuration, setPlaybackTime]);

    useEffect(() => {
        return registerMessageHandler(`${APP_KEY}/internal`, message => {
            if (message.type === "fade") {
                const payload = message.payload;
                if (payload.playlist !== props.playlist) return;
                
                if (payload.fade === "in") {
                    handleFadeIn();
                }
                else if (payload.fade === "out") {
                    handleFadeOut();
                }
            }
        });
    }, [fading, current.playing, current.volume, fadeTime, registerMessageHandler, props.playlist, handleFadeIn, handleFadeOut]);
    
    return <Card sx={{ p: 1, mb: 1, position: "relative" }}>
        <audio
            src={current.track?.source}
            ref={audioRef}
            onError={handleAudioError}
            onCanPlayThrough={handleAudioLoaded}
        />
        <Box sx={{ display: "flex", flexDirection: "row", gap: 1 }}>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                <Slider
                    min={0}
                    max={100}
                    value={(current.volume ?? 0) * 100}
                    onChange={(_, value) => setVolume(value as number / 100, props.playlist)}
                    orientation="vertical"
                    disabled={fading}
                />
                <FontAwesomeIcon 
                    icon={
                        current.volume == 0 
                        ? faVolumeOff 
                        : (current.volume < 0.5)
                        ? faVolumeLow
                        : faVolumeHigh
                    } 
                    style={{width: "1rem"}}
                    className={fading ? "disabled" : undefined}
                />
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", flex: 1}}>
                <Typography>
                    <Box component="span" fontWeight="bold">{ props.playlist }:</Box> { current.track?.name }
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 2}}>
                    <Typography sx={{ userSelect: "none" }}>{formatTime(current.time)}</Typography>
                        <Slider
                            orientation="horizontal"
                            size="small"
                            min={0}
                            max={500}
                            value={current.duration ? (current.time / current.duration * 500) : 0}
                            onChange={(_, value) => setAudioTime(value as number / 500 * current.duration!)}
                            disabled={!loaded}
                        />
                    <Typography sx={{ userSelect: "none" }}>{formatTime(current.duration ?? 0)}</Typography>
                </Box>
                <Box sx={{ display: "flex", flexDirection: "row", gap: 1, justifyContent: "space-between", alignItems: "center"}}>
                    <Box sx={{ display: "flex", flexDirection: "row", gap: 0.5}}>
                        <IconButton
                            onClick={handleFadeIn}
                            disabled={fading || current.playing || !loaded}
                        >
                            <Box
                                component="img"
                                sx={{ userSelect: "none" }}
                                src={FadeIn}
                            />
                        </IconButton>
                        <IconButton
                            onClick={() => changeTrack(-1)}
                            disabled={fading}
                        >
                            <FontAwesomeIcon
                                icon={faBackward}
                            />
                        </IconButton>
                        <IconButton
                            onClick={fading ? undefined : () => setIsPlaying(!current.playing, props.playlist)}
                            disabled={fading || !loaded}
                        >
                            <FontAwesomeIcon icon={current.playing ? faPause : faPlay} />
                        </IconButton>
                        <IconButton
                            onClick={() => changeTrack(+1)}
                            disabled={fading}
                        >
                            <FontAwesomeIcon icon={faForward} />
                        </IconButton>
                        <IconButton
                            onClick={handleFadeOut}
                            disabled={fading || !current.playing || !loaded}    
                        >
                            <Box
                                component="img"
                                sx={{ userSelect: "none" }}
                                src={FadeOut}
                            />
                        </IconButton>
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "row", gap: 4, mr: 5 }}>
                        <IconButton size="small" onClick={() => nextRepeatMode()} sx={{ opacity: current.repeatMode === "no-repeat" ? 0.5 : 1 }}>
                            {
                                current.repeatMode === "repeat-self" ? 
                                <Box component="img" src={RepeatSelf} style={{width: "1.1rem", userSelect: "none" }} />
                                : <FontAwesomeIcon icon={faRepeat} />
                            }
                        </IconButton>
                        <IconButton size="small" onClick={() => setShuffle(!current.shuffle, props.playlist)} sx={{ opacity: current.shuffle ? 1 : 0.5 }}>
                            <FontAwesomeIcon icon={faShuffle} />
                        </IconButton>
                    </Box>
                </Box>
            </Box>
        </Box>
        <IconButton 
            sx={{ position: "absolute", top: 5, right: 5 }}
            size="small"
            onClick={() => setCurrentTrack(undefined)}
        >
            <FontAwesomeIcon icon={faClose} />
        </IconButton>
        <Box sx={{ position: "absolute", bottom: 2, right: 10 }}>
            {
                (!loaded && !errored) ?
                <CircularProgress size="1rem" />
                :
                errored && <FontAwesomeIcon 
                    color="red"
                    icon={faCircleExclamation}
                    title={errorMessage}
                    onClick={() => { setErrored(false); audioRef.current?.load?.(); } }
                />
            }
        </Box>
    </Card>;
}
