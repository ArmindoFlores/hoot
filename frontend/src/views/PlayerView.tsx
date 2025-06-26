import { AudioObject, useControlledAudio } from "../providers/ControlledPlayerProvider";
import { Box, Button, Card, Collapse, IconButton, Slider, Typography } from "@mui/material";
import { PlayerSettingsProvider, usePlayerSettings } from "../providers/PlayerSettingsProvider";
import { faVolumeHigh, faVolumeLow, faVolumeMute, faVolumeOff } from "@fortawesome/free-solid-svg-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { INTERNAL_BROADCAST_CHANNEL } from "../config";
import { MessageContent } from "../types/messages";
import OBR from "@owlbear-rodeo/sdk";
import { PlayerTrack } from "../types/tracks";
import { logging } from "../logging";
import { useOBRBroadcast } from "../hooks/obr";

interface PlayerAudioIndicatorProps {
    playlist: string;
    globalVolume: number;
    track?: PlayerTrack;
    autoplayError: () => void;
    triggerPlayback: number;
}

function PlayerAudioIndicator({ 
    playlist,
    track,
    autoplayError,
    triggerPlayback
}: PlayerAudioIndicatorProps) {
    const { loadTrack, unloadTrack } = useControlledAudio();
    const { playlistVolume, setPlaylistVolume } = usePlayerSettings();
    const trackId = useMemo(() => track?.id ?? null, [track?.id]);
    const prevTrackIdRef = useRef<string|null>(null);
    const audioObjectRef = useRef<AudioObject|null>(null);

    const [ duration, setDuration ] = useState<number|null>(null);
    const [ position, setPosition ] = useState<number|null>(track?.position ?? null);
    const [ loading, setLoading ] = useState(false);

    const playTrack = useCallback(async (audio: HTMLAudioElement, name: string) => {
        try {
            return await audio.play();
        } 
        catch (reason_) {
            const reason = reason_ as DOMException;
            logging.error(reason, reason.name);
            if (reason.name === "NotAllowedError") {
                // Autoplay issue
                OBR.notification.show(
                    "Autoplay is disabled. Please press the 'Reset Playback' button in the Hoot page.", 
                    "WARNING"
                );
                // autoplayError();
            }
            else if (reason.name === "AbortError") {
                // This is not really an error for us
            }
            else {
                // Some other issue
                OBR.notification.show(`Error starting track '${name}': ${reason.message}`, "ERROR");
            }
        }
    }, []);

    useEffect(() => {
        if (track == undefined || prevTrackIdRef.current == track.id) return;
        prevTrackIdRef.current = track.id;

        setLoading(true);
        loadTrack(track.playlist, track.source, track.name, track.id).then(audioObject => {
            audioObjectRef.current = audioObject;
            audioObject.audio.currentTime = track.position;
            audioObject.gain.gain.setValueAtTime(track.volume, track.position);
            setDuration(audioObject.audio.duration);
            if (track.playing) {
                playTrack(audioObject.audio, track.name);
            }
        }).finally(() => setLoading(false));
    }, [loadTrack, track, playTrack]);

    useEffect(() => {
        if (track == undefined || audioObjectRef.current == null) return;

        // Verify if there is a significant discrepancy in the track position:
        if (Math.abs(track.position - audioObjectRef.current.audio.currentTime) > 1) {
            logging.info("Adjusting track position");
            audioObjectRef.current.audio.currentTime = track.position;
        }

        // Verify if the track should be played/paused
        if (track.playing && audioObjectRef.current.audio.paused) {
            playTrack(audioObjectRef.current.audio, track.name);
        }
        else if (!track.playing && !audioObjectRef.current.audio.paused) {
            audioObjectRef.current.audio.pause();
        }

        audioObjectRef.current.gain.gain.setValueAtTime(track.volume, audioObjectRef.current.audio.currentTime);
    }, [track, playTrack]);

    useEffect(() => {
        if (loading) return;

        console.log("Registering event listener");
        const audioElement = audioObjectRef.current?.audio;
        if (audioElement) {
            const handleTimeUpdate = () => {
                setPosition(audioElement.currentTime);
            };

            audioElement.addEventListener("timeupdate", handleTimeUpdate);

            return () => audioElement.removeEventListener("timeupdate", handleTimeUpdate);
        }
    }, [trackId, loading]);

    useEffect(() => {
        if (trackId == null || audioObjectRef.current == null) return;
        audioObjectRef.current.playerGain.gain.setValueAtTime(playlistVolume, audioObjectRef.current.audio.currentTime);
    }, [playlistVolume, trackId]);

    return <Card key={playlist} sx={{ p: 2, mb: 1 }}>
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Typography sx={{flex: 2}} fontWeight="bold">{ playlist } </Typography>
            <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", flex: 1, gap: 2 }}>
                <FontAwesomeIcon icon={faVolumeHigh} style={{opacity: track?.playing ? 1 : 0}} />
                <Slider
                    size="small"
                    value={playlistVolume * 100}
                    onChange={(_, value) => setPlaylistVolume(value as number / 100)}
                    orientation="horizontal"
                />
            </Box>
        </Box>
        {
            track && 
            <Slider
                size="small"
                orientation="horizontal"
                value={(duration != null && position != null) ? (position / duration * 100) : 0}
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

    const [ tracks, setTracks ] = useState<Record<string, PlayerTrack>>({});
    const [ previousVolume, setPreviousVolume ] = useState(volume);
    const [ volumeHovered, setVolumeHovered ] = useState(false);
    const [ mute, setMute ] = useState(false);
    const [ autoplayErrorOccurred, setAutoplayErrorOccurred ] = useState(false);
    const [ triggerPlayback, setTriggerPlayback ] = useState(0);
    const { registerMessageHandler } = useOBRBroadcast<MessageContent>();

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
            <Box sx={{ p: 1 }} />
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
