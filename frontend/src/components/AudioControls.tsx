import { APIHandler, ClientAPI } from "@armindoflores/obr-ext-core";
import { Box, Card, CircularProgress, IconButton, Slider, Typography } from "@mui/material";
import { faBackward, faCircleExclamation, faClose, faForward, faPause, faPlay, faRepeat, faShuffle, faVolumeHigh, faVolumeLow, faVolumeOff } from "@fortawesome/free-solid-svg-icons";
import { useCallback, useEffect, useRef, useState } from "react";

import { CSS } from "@dnd-kit/utilities";
import { DragIndicator } from "@mui/icons-material";
import FadeIn from "../assets/fadein.svg";
import FadeOut from "../assets/fadeout.svg";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { HootAsyncUpdatesMessageRegistry } from "../types/broadcast/asyncUpdates";
import { HootAudioControlsMessageRegistry } from "../types/broadcast/audioControls";
import { HootAudioInfoMessage } from "../types/broadcast/messages";
import { NoResponse } from "@armindoflores/obr-ext-core/utils";
import OBR from "@owlbear-rodeo/sdk";
import { RepeatMode } from "../types/tracks";
import RepeatSelf from "../assets/repeat-self.svg";
import { constants } from "../constants";
import { logging } from "../logging";
import { uniqueId } from "lodash";
import { useSettings } from "../providers/SettingsProvider";
import { useSortable } from "@dnd-kit/sortable";

export interface AudioControlsProps {
    playlist: string;
    unload: () => void;
}

interface AudioProgressBarProps {
    value: number;
    seek: (position: number) => void;
    loaded: boolean;
    duration: number | null;
    playing: boolean;
    fetchData: () => void;
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

async function runAndShowError<R>(func: () => Promise<R>, errorPrefix: string = ""): Promise<R | undefined> {
    try {
        return await func();
    }
    catch (error) {
        OBR.notification.show(`${errorPrefix}${(error as Error).message}`, "ERROR");
    }
}

function AudioProgressBar({ value, seek, loaded, duration, playing, fetchData }: AudioProgressBarProps) {
    const [ position, setPosition ] = useState(value);
    const isSeeking = useRef(false);

    useEffect(() => {
        if (!isSeeking.current) {
            setPosition(value);
        }
    }, [value]);

    useEffect(() => {
        if (duration === null || !playing) return;

        let rafId: number;
        let lastTimestamp: number | null = null;
        let lastUpdate = 0;
        const UPDATE_INTERVAL = 250;

        const tick = (timestamp: number) => {
            if (lastTimestamp === null) lastTimestamp = timestamp;
            const elapsed = (timestamp - lastTimestamp) / 1000;
            const newPosition = value + elapsed;

            if (newPosition >= duration) {
                cancelAnimationFrame(rafId);
                return;
            }

            if (!isSeeking.current && timestamp - lastUpdate >= UPDATE_INTERVAL) {
                setPosition(newPosition);
                lastUpdate = timestamp;
            }

            rafId = requestAnimationFrame(tick);
        };

        setPosition(value);
        rafId = requestAnimationFrame(tick);

        return () => cancelAnimationFrame(rafId);
    }, [value, playing, duration, fetchData]);

    return <>
        <Typography sx={{ userSelect: "none" }}>{formatTime(position ?? 0)}</Typography>
        <Slider
            orientation="horizontal"
            size="small"
            value={(duration === null || isNaN(duration) || duration === 0) ? 0 : (position / duration * 100)}
            onChange={(_, value) => { isSeeking.current = true; setPosition(value as number / 100 * (duration ?? 0)); }}
            onChangeCommitted={(_, value) => {
                isSeeking.current = false;
                if (duration == null) return;
                seek(value as number / 100 * duration);
            }}
            disabled={!loaded}
        />
        <Typography sx={{ userSelect: "none" }}>{formatTime(duration ?? 0)}</Typography>
    </>
}

export function AudioControls(props: AudioControlsProps) {
    const audioAPIClient = useRef(new ClientAPI<HootAudioControlsMessageRegistry>(
        constants.AUDIO_CONTROLLER_MESSAGE_CHANNEL_ID,
        constants.AUDIO_CONTROLLER_CLIENT_MESSAGE_CHANNEL_ID,
        "LOCAL",
    ));
    const { fadeTime } = useSettings();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition
    } = useSortable({ id: props.playlist });
    
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    const [ name, setName ] = useState("");
    const [ error, setError ] = useState<Error|null>(null);
    const [ fading, setFading ] = useState<[string, "in" | "out"]|null>(null);
    const [ playing, setPlaying ] = useState(false);
    const [ position, setPosition ] = useState(0);
    const [ duration, setDuration ] = useState(0);
    const [ repeatMode, _setRepeatMode ] = useState<RepeatMode>("no-repeat");
    const [ shuffle, _setShuffle ] = useState(false);
    const [ volume, _setVolume ] = useState(1);
    const isAdjustingVolume = useRef(false);

    const [ loaded, setLoaded ] = useState(false);

    const runAndSetError = useCallback(async function<R>(func: () => Promise<R>): Promise<R> {
        try {
            const r = await func();
            return r;
        }
        catch (error) {
            setError(error as Error);
            throw error;
        }
    }, []);

    const play = useCallback(async () => {
        await runAndSetError(() => audioAPIClient.current.request<"HOOT_PLAY">(
            {type: "HOOT_PLAY", playlist: props.playlist},
            undefined, undefined, true
        ));
        setPlaying(true);
    }, [props.playlist, runAndSetError]);

    const pause = useCallback(async () => {
        await runAndSetError(() => audioAPIClient.current.request<"HOOT_PAUSE">(
            {type: "HOOT_PAUSE", playlist: props.playlist},
            undefined, undefined, true
        ));
        setPlaying(false);
    }, [props.playlist, runAndSetError]);

    const fadeIn = useCallback(async () => {
        await runAndSetError(() => audioAPIClient.current.request<"HOOT_FADE">(
            {type: "HOOT_FADE", playlist: props.playlist, duration: fadeTime, fade: "in"},
            undefined, undefined, true
        ));
        setPlaying(true);
    }, [props.playlist, runAndSetError, fadeTime]);

    const fadeOut = useCallback(async () => {
        await runAndSetError(() => audioAPIClient.current.request<"HOOT_FADE">(
            {type: "HOOT_FADE", playlist: props.playlist, duration: fadeTime, fade: "out"},
            undefined, undefined, true
        ));
    }, [props.playlist, runAndSetError, fadeTime]);

    const setVolume = useCallback(async (volume: number) => {
        await runAndSetError(() => audioAPIClient.current.request<"HOOT_SET_VOLUME">(
            {type: "HOOT_SET_VOLUME", playlist: props.playlist, volume},
            undefined, undefined, true
        ));
        _setVolume(volume);
    }, [props.playlist, runAndSetError]);

    const seek = useCallback(async (position: number) => {
        await runAndSetError(() => audioAPIClient.current.request<"HOOT_SEEK">(
            {type: "HOOT_SEEK", playlist: props.playlist, position},
            undefined, undefined, true
        ));
        setPosition(position);
    }, [props.playlist, runAndSetError]);

    const reload = useCallback(async () => {
        setError(null);
    }, []);

    const next = useCallback(async () => {
        await runAndSetError(() => audioAPIClient.current.request<"HOOT_NEXT_TRACK">(
            {type: "HOOT_NEXT_TRACK", playlist: props.playlist},
            undefined, undefined, true
        ));
        setPosition(0);
    }, [props.playlist, runAndSetError]);

    const prev = useCallback(async () => {
        await runAndSetError(() => audioAPIClient.current.request<"HOOT_PREVIOUS_TRACK">(
            {type: "HOOT_PREVIOUS_TRACK", playlist: props.playlist},
            undefined, undefined, true
        ));
        setPosition(0);
    }, [props.playlist, runAndSetError]);

    const setShuffle = useCallback(async (shuffle: boolean) => {
        await runAndSetError(() => audioAPIClient.current.request<"HOOT_SET_SHUFFLE">(
            {type: "HOOT_SET_SHUFFLE", playlist: props.playlist, shuffle},
            undefined, undefined, true
        ));
        _setShuffle(shuffle);
    }, [props.playlist, runAndSetError]);

    const setRepeatMode = useCallback(async (repeat: RepeatMode) => {
        await runAndSetError(() => audioAPIClient.current.request<"HOOT_SET_REPEAT_MODE">(
            {type: "HOOT_SET_REPEAT_MODE", playlist: props.playlist, repeat},
            undefined, undefined, true
        ));
        _setRepeatMode(repeat);
    }, [props.playlist, runAndSetError]);

    const unloadTrack = useCallback(async () => {
        await runAndSetError(() => audioAPIClient.current.request<"HOOT_UNLOAD">(
            {type: "HOOT_UNLOAD", playlist: props.playlist},
            undefined, undefined, true
        ));
        props.unload();
    }, [props, runAndSetError]);

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
    }, [setRepeatMode]);

    const updateDataFromMessage = useCallback((response: HootAudioInfoMessage) => {
        setName(response.title);
        setPlaying(response.playing);
        if (!isAdjustingVolume.current) {
            _setVolume(response.volume);
        }
        setPosition(response.position);
        setDuration(response.duration);
        _setRepeatMode(response.repeat);
        _setShuffle(response.shuffle);
        setLoaded(true);
    }, []);

    const startFade = useCallback((fadeType: "in" | "out", duration: number) => {
        const id = uniqueId();
        setFading([id, fadeType]);
        setTimeout(() => setFading(old => {
            if (old === null || old[0] === id) {
                return null;
            }
            return old;
        }), duration);
    }, []);

    const fetchData = useCallback(() => {
        audioAPIClient.current.request<"HOOT_GET_AUDIO_INFO">(
            {type: "HOOT_GET_AUDIO_INFO", playlist: props.playlist}
        ).then(response => {
            if (response.type === "ERROR") {
                logging.error("internal API error", response.error);
                return;
            }
            updateDataFromMessage(response);
        });
    }, [props.playlist, updateDataFromMessage]);

    useEffect(() => {
        fetchData();
        
        window.addEventListener("focus", fetchData);
        const intervalId = setInterval(fetchData, 5000);

        return () => {
            window.removeEventListener("focus", fetchData);
            clearTimeout(intervalId);
        }
    }, [fetchData]);

    useEffect(() => {
        const asyncUpdatesHandler = new APIHandler<HootAsyncUpdatesMessageRegistry>(
            constants.ASYNC_UPDATES_MESSAGE_CHANNEL_ID,
            constants.ASYNC_UPDATES_MESSAGE_CHANNEL_ID,
        );

        for (const messageType of ["HOOT_AUDIO_INFO" as const, "HOOT_FADE" as const]) {
            asyncUpdatesHandler.setMessageFilter(
                messageType, 
                message => message.playlist === props.playlist
            );
        }

        asyncUpdatesHandler.setHandler("HOOT_AUDIO_INFO", async message => {
            updateDataFromMessage(message);
            return NoResponse;
        });

        asyncUpdatesHandler.setHandler("HOOT_FADE", async message => {
            startFade(message.fade, message.duration);
            return NoResponse;
        });

        asyncUpdatesHandler.register();

        return () => asyncUpdatesHandler.unregister();
    }, [props.playlist, updateDataFromMessage, startFade]);

    return <Box ref={setNodeRef} {...attributes} style={style}>
        <Card sx={{ p: 1, pt: 2, mb: 1, position: "relative" }}>
            <Box sx={{ display: "flex", flexDirection: "row", gap: 1 }}>
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
                    <Slider
                        size="small"
                        value={(volume ?? 0) * 100}
                        onChange={(_, value) => {
                            isAdjustingVolume.current = true;
                            _setVolume(value as number / 100);
                        }}
                        onChangeCommitted={(_, value) => {
                            isAdjustingVolume.current = false;
                            setVolume(value as number / 100);
                        }}
                        orientation="vertical"
                        disabled={fading !== null}
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
                    <Box sx={{ display: "flex", flexDirection: "row", alignItems: "baseline", gap: 2 }}>
                        <Typography>
                            <Box component="span" fontWeight="bold">{ props.playlist }:</Box> { name }
                        </Typography>
                        <Box>
                            {
                                (!loaded && error == null) ?
                                <CircularProgress size="1rem" />
                                :
                                error != null && <IconButton size="small" title={error.message} onClick={() => runAndShowError(reload, "Error loading track: ")}>
                                    <FontAwesomeIcon 
                                        color="red"
                                        icon={faCircleExclamation}
                                    />
                                </IconButton>
                            }
                        </Box>
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 2}}>
                        <AudioProgressBar value={position} loaded={loaded} seek={seek} duration={duration} playing={playing} fetchData={fetchData} />
                    </Box>
                    <Box sx={{ display: "flex", flexDirection: "row", gap: 1, justifyContent: "space-between", alignItems: "center"}}>
                        <Box sx={{ display: "flex", flexDirection: "row", gap: 0.5}}>
                            <IconButton
                                onClick={() => runAndShowError(fadeIn, "Error fading in track:")}
                                sx={{ opacity: (fading !== null || playing || !loaded) ? 0.5 : 1 }}
                                disabled={fading !== null || playing || !loaded}
                                title="Fade in"
                            >
                                <Box
                                    component="img"
                                    sx={{ userSelect: "none" }}
                                    src={FadeIn}
                                />
                            </IconButton>
                            <IconButton
                                onClick={() => runAndShowError(prev, "Error playing track: ")}
                                disabled={fading !== null}
                                title="Previous track"
                            >
                                <FontAwesomeIcon
                                    icon={faBackward}
                                />
                            </IconButton>
                            <IconButton
                                onClick={fading !== null ? undefined : (playing ? pause : () => runAndShowError(play, "Error playing track: "))}
                                disabled={fading !== null || !loaded}
                                title={playing ? "Pause" : "Play"}
                            >
                                <FontAwesomeIcon icon={playing ? faPause : faPlay} />
                            </IconButton>
                            <IconButton
                                onClick={() => runAndShowError(next, "Error playing track: ")}
                                disabled={fading !== null}
                                title="Next track"
                            >
                                <FontAwesomeIcon icon={faForward} />
                            </IconButton>
                            <IconButton
                                onClick={() => runAndShowError(fadeOut, "Error fading out track:")}
                                sx={{ opacity: (fading !== null || !playing || !loaded) ? 0.5 : 1 }}
                                disabled={fading !== null || !playing || !loaded}    
                                title="Fade out"
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
                            <IconButton
                                size="small"
                                onClick={() => setShuffle(!shuffle)} sx={{ opacity: shuffle ? 1 : 0.5 }}
                                title={(shuffle ? "Disable" : "Enable") + " shuffling"}
                            >
                                <FontAwesomeIcon icon={faShuffle} />
                            </IconButton>
                        </Box>
                    </Box>
                </Box>
            </Box>
            <IconButton 
                onClick={unloadTrack}
                sx={{ position: "absolute", top: 5, right: 5 }}
                size="small"
                title="Stop track and close playlist"
            >
                <FontAwesomeIcon icon={faClose} />
            </IconButton>
            <IconButton title="Drag" size="small" sx={{ position: "absolute", bottom: 2, right: 2 }} {...listeners}>
                <DragIndicator />
            </IconButton>
        </Card>
    </Box>;
}
