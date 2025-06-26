import { Box, Button, Card, Collapse, IconButton, Slider, Typography } from "@mui/material";
import { PlayerSettingsProvider, usePlayerSettings } from "../providers/PlayerSettingsProvider";
import { faVolumeHigh, faVolumeLow, faVolumeMute, faVolumeOff } from "@fortawesome/free-solid-svg-icons";
import { fadeInVolume, fadeOutVolume } from "../utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { INTERNAL_BROADCAST_CHANNEL } from "../config";
import { MessageContent } from "../types/messages";
import OBR from "@owlbear-rodeo/sdk";
import { PlayerTrack } from "../types/tracks";
import { logging } from "../logging";
import { useControlledAudio } from "../providers/ControlledPlayerProvider";
import { useOBRBroadcast } from "../hooks/obr";

interface PlayerAudioIndicatorProps {
    playlist: string;
    globalVolume: number;
    track?: PlayerTrack;
    autoplayError: () => void;
    triggerPlayback: number;
}

type TrackWithDuration = PlayerTrack & { duration?: number };

function PlayerAudioIndicator({ 
    playlist,
    globalVolume,
    track,
    autoplayError,
    triggerPlayback
}: PlayerAudioIndicatorProps) {
    const { loadTrack, unloadTrack } = useControlledAudio();
    const { registerMessageHandler } = useOBRBroadcast<MessageContent>();
    const { playlistVolume, setPlaylistVolume } = usePlayerSettings();
    const audioRef = useRef<HTMLAudioElement>(null);
    
    const [ duration, setDuration ] = useState<number|null>(null);
    const [ loaded, setLoaded ] = useState(false);
    const [ fading, setFading ] = useState(false);
    const [ fade, setFade ] = useState();

    const playTrack = useCallback(() => {
        audioRef.current!.play().catch((reason: DOMException) => {
            logging.error(reason, reason.name);
            if (reason.name === "NotAllowedError") {
                // Autoplay issue
                OBR.notification.show(
                    "Autoplay is disabled. Please press the 'Reset Playback' button in the Hoot page.", 
                    "WARNING"
                );
                autoplayError();
            }
            else if (reason.name === "AbortError") {
                // This is not really an error for us
            }
            else {
                // Some other issue
                OBR.notification.show(`Error starting track '${trackWithDuration?.name}': ${reason.message}`, "ERROR");
            }
        });
    }, [autoplayError, trackWithDuration?.name]);

    useEffect(() => {
        if (track == undefined) return;

        loadTrack(track.playlist, track.source, track.name, track.name).then(audioObject => {
        })
    }, []);

    // useEffect(() => {
    //     const audioElement = audioRef.current;
    //     if (audioElement) {
    //         const handleTimeUpdate = () => {
    //             setPlaybackTime(audioElement.currentTime);
    //         };

    //         audioElement.addEventListener("timeupdate", handleTimeUpdate);

    //         return () => audioElement.removeEventListener("timeupdate", handleTimeUpdate);
    //     }
    // }, [trackWithDuration?.name, trackWithDuration?.source]);

    return <Card key={playlist} sx={{ p: 2, mb: 1 }}>
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Typography sx={{flex: 2}} fontWeight="bold">{ playlist } </Typography>
            <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", flex: 1, gap: 2 }}>
                <FontAwesomeIcon icon={faVolumeHigh} style={{opacity: trackWithDuration?.playing ? 1 : 0}} />
                <Slider
                    size="small"
                    value={playlistVolume * 100}
                    onChange={(_, value) => setPlaylistVolume(value as number / 100)}
                    orientation="horizontal"
                />
            </Box>
        </Box>
        {
            trackWithDuration && 
            <Slider
                size="small"
                orientation="horizontal"
                value={trackWithDuration.duration ? (trackWithDuration.position / trackWithDuration.duration * 100) : 0}
                disabled
            />
        }
    </Card>;
}

export function PlayerView() {
    const {
        volume,
        setVolume,
    } = useControlledAudio();
    const { registerMessageHandler, sendMessage } = useOBRBroadcast<MessageContent>();

    const [ tracks, setTracks ] = useState<Record<string, PlayerTrack>>({});
    const [ previousVolume, setPreviousVolume ] = useState(volume);
    const [ volumeHovered, setVolumeHovered ] = useState(false);
    const [ mute, setMute ] = useState(false);
    const [ autoplayErrorOccurred, setAutoplayErrorOccurred ] = useState(false);
    const [ triggerPlayback, setTriggerPlayback ] = useState(0);

    const playlists = useMemo(() => Object.keys(tracks), [tracks]);

    const toggleMute = useCallback(() => {
        if (volume === 0) {
            setVolume(previousVolume);
        }
        else {
            setPreviousVolume(volume);
            setMute(true);
            setVolume(0);
        }
    }, [previousVolume, volume, setVolume]);

    const restartPlayback = useCallback(() => { 
        setAutoplayErrorOccurred(false); 
        setTriggerPlayback(old => old+1); 
    }, []);

    useEffect(() => {
        if (volume !== 0) {
            setMute(false);
        }
    }, [volume]);

    useEffect(() => {
        logging.info("Registered message handler.");
        return registerMessageHandler(INTERNAL_BROADCAST_CHANNEL, message => {
            logging.info("Received message:", message);
            if (message.type === "playing") {
                setTracks(
                    Object.fromEntries(
                        message.payload.playing.map(track => ([track.playlist, track]))
                    )
                );
            }
            else {
                logging.error(`Received invalid message of type '${message.type}':`, message);
            }
        });
    }, [registerMessageHandler]);

    return <Box sx={{ p: 2 }}>
        <Box>
            <Typography variant="h5">Currently Playing</Typography>
            {
                autoplayErrorOccurred &&
                <Button variant="outlined" onClick={restartPlayback}>
                    Restart Playback
                </Button>
            }
        </Box>
        <Box>
            {
                playlists.length === 0 &&
                <Typography>
                    No tracks are playing. 
                </Typography>
            }
            {
                playlists.map(playlist => (
                    <PlayerSettingsProvider key={playlist} playlist={playlist}>
                        <PlayerAudioIndicator
                            playlist={playlist}
                            track={tracks[playlist]}
                            globalVolume={volume}
                            triggerPlayback={triggerPlayback}
                            autoplayError={() => setAutoplayErrorOccurred(true)} 
                        />
                    </PlayerSettingsProvider>
                ))
            }
        </Box>
        <Box
            onMouseEnter={() => setVolumeHovered(true)}
            onMouseLeave={() => setVolumeHovered(false)}
            sx={{
                position: "absolute",
                bottom: "0.5rem",
                right: "1rem",
                background: (theme) => theme.palette.background.default,
                borderRadius: 5,
            }}
        >
            <Collapse in={volumeHovered}>
                <Box sx={{ height: "7rem", pb: 1, pt: 2, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <Slider
                        size="small"
                        min={0}
                        max={100}
                        value={(volume ?? 0) * 100}
                        onChange={(_, value) => setVolume(value as number / 100)}
                        orientation="vertical"
                    />
                </Box>
            </Collapse>
            <IconButton 
                onClick={toggleMute}
            >
                <FontAwesomeIcon 
                    icon={
                        mute
                        ? faVolumeMute
                        : volume == 0 
                        ? faVolumeOff 
                        : (volume < 0.5)
                        ? faVolumeLow
                        : faVolumeHigh
                    } 
                    style={{width: "1rem", height: "1rem"}}
                />
            </IconButton>
        </Box>
    </Box>;
}
