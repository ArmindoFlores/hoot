import { Box, Card, CircularProgress, IconButton, Slider, Typography } from "@mui/material";
import { faBackward, faCircleExclamation, faClose, faForward, faPause, faPlay, faRepeat, faShuffle, faVolumeHigh, faVolumeLow, faVolumeOff } from "@fortawesome/free-solid-svg-icons";
import { useAudio, useAudioControls } from "../providers/AudioPlayerProvider";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import FadeIn from "../assets/fadein.svg";
import FadeOut from "../assets/fadeout.svg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { MessageContent } from "../types/messages";
import OBR from "@owlbear-rodeo/sdk";
import { RepeatMode } from "../types/tracks";
import RepeatSelf from "../assets/repeat-self.svg";
import { useOBRBroadcast } from "../hooks/obr";
import { useSettings } from "../providers/SettingsProvider";
import { useThrottled } from "../hooks";
import { useTracks } from "../providers/TrackProvider";

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
        name,
        playing,
        loaded,
        duration,
        volume,
        position,
        load,
        play,
        pause,
        fadeIn,
        fadeOut,
        setVolume,
        seek,
    } = useAudioControls(props.playlist);
    const { unloadTrack } = useAudio();
    const { fadeTime } = useSettings();
    const { tracks } = useTracks();
    const { sendMessage, registerMessageHandler } = useOBRBroadcast<MessageContent>();
    const audioRef = useRef<HTMLAudioElement>(null);
    
    const [ shuffled, setShuffled ] = useState<typeof tracks>(new Map());
    const [ shuffle, setShuffle ] = useState(false);
    const [ repeatMode, setRepeatMode ] = useState<RepeatMode>("no-repeat");
    const [ scheduledUpdate, setScheduledUpdate ] = useState(false);
    const [ fading, setFading ] = useState(false);
    const [ errored, setErrored] = useState(false);
    const [ errorMessage, setErrorMessage] = useState("");

    const sliderValue = (position != undefined && duration != undefined && duration != 0) ? position / duration * 100 : 0;
    const throttledSend = useThrottled(sendMessage, 250, "trailing");

    const nextRepeatMode = useCallback((prev: RepeatMode) => {
        if (prev === "no-repeat") {
            setRepeatMode("repeat-all");
        }
        else if (prev === "repeat-all") {
            setRepeatMode("repeat-self");
        }
        else {
            setRepeatMode("no-repeat");
        }
    }, []);

    const handleFadeIn = useCallback(async () => {
        setFading(true);
        await fadeIn(fadeTime);
        setFading(false);
    }, [fadeTime, fadeIn]);

    const handleFadeOut = useCallback(async () => {
        setFading(true);
        await fadeOut(fadeTime);
        setFading(false);
    }, [fadeTime, fadeOut]);

    // const handleAudioError = useCallback(() => {
    //     OBR.notification.show(`Error loading track '${current.track.name}': ${audioRef.current?.error?.message}`, "ERROR");
    //     setErrored(true);
    //     setErrorMessage(`Error loading track (${audioRef.current?.error?.message})`);
    // }, []);
    
    return <Card sx={{ p: 1, pt: 2, mb: 1, position: "relative" }}>
        <Box sx={{ display: "flex", flexDirection: "row", gap: 1 }}>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                <Slider
                    size="small"
                    value={(volume ?? 0) * 100}
                    onChange={(_, value) => setVolume(value as number / 100)}
                    orientation="vertical"
                    disabled={fading}
                />
                <FontAwesomeIcon 
                    icon={
                        volume == 0 
                        ? faVolumeOff 
                        : (volume < 0.5)
                        ? faVolumeLow
                        : faVolumeHigh
                    } 
                    style={{width: "1rem"}}
                    className={fading ? "disabled" : undefined}
                />
            </Box>
            <Box sx={{ display: "flex", flexDirection: "column", flex: 1}}>
                <Typography>
                    <Box component="span" fontWeight="bold">{ props.playlist }:</Box> { name }
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 2}}>
                    <Typography sx={{ userSelect: "none" }}>{formatTime(position ?? 0)}</Typography>
                        <Slider
                            key={`slider-${sliderValue.toFixed(2)}`}
                            orientation="horizontal"
                            size="small"
                            value={sliderValue}
                            onChange={(_, value) => duration != null ? seek(value as number / 100 * duration) : undefined}
                            disabled={!loaded}
                        />
                    <Typography sx={{ userSelect: "none" }}>{formatTime(duration ?? 0)}</Typography>
                </Box>
                <Box sx={{ display: "flex", flexDirection: "row", gap: 1, justifyContent: "space-between", alignItems: "center"}}>
                    <Box sx={{ display: "flex", flexDirection: "row", gap: 0.5}}>
                        <IconButton
                            onClick={handleFadeIn}
                            sx={{ opacity: (fading || playing || !loaded) ? 0.5 : 1 }}
                            disabled={fading || playing || !loaded}
                        >
                            <Box
                                component="img"
                                sx={{ userSelect: "none" }}
                                src={FadeIn}
                            />
                        </IconButton>
                        <IconButton
                            disabled={fading}
                        >
                            <FontAwesomeIcon
                                icon={faBackward}
                            />
                        </IconButton>
                        <IconButton
                            onClick={fading ? undefined : (playing ? pause : play)}
                            disabled={fading || !loaded}
                        >
                            <FontAwesomeIcon icon={playing ? faPause : faPlay} />
                        </IconButton>
                        <IconButton
                            disabled={fading}
                        >
                            <FontAwesomeIcon icon={faForward} />
                        </IconButton>
                        <IconButton
                            onClick={handleFadeOut}
                            sx={{ opacity: (fading || !playing || !loaded) ? 0.5 : 1 }}
                            disabled={fading || !playing || !loaded}    
                        >
                            <Box
                                component="img"
                                sx={{ userSelect: "none" }}
                                src={FadeOut}
                            />
                        </IconButton>
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "row", gap: 4, mr: 5 }}>
                        <IconButton size="small" onClick={() => nextRepeatMode(repeatMode)} sx={{ opacity: repeatMode === "no-repeat" ? 0.5 : 1 }}>
                            {
                                repeatMode === "repeat-self" ? 
                                <Box component="img" src={RepeatSelf} style={{width: "1.1rem", userSelect: "none" }} />
                                : <FontAwesomeIcon icon={faRepeat} />
                            }
                        </IconButton>
                        <IconButton size="small" onClick={() => setShuffle(!shuffle)} sx={{ opacity: shuffle ? 1 : 0.5 }}>
                            <FontAwesomeIcon icon={faShuffle} />
                        </IconButton>
                    </Box>
                </Box>
            </Box>
        </Box>
        <IconButton 
            onClick={() => unloadTrack(props.playlist)}
            sx={{ position: "absolute", top: 5, right: 5 }}
            size="small"
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
