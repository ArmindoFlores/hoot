import { Box, Button, Collapse, IconButton, Slider, Typography } from "@mui/material";
import { FadeObject, MessageContent } from "../types/messages";
import { PlayerSettingsProvider, usePlayerSettings } from "../providers/PlayerSettingsProvider";
import { faVolumeHigh, faVolumeLow, faVolumeMute, faVolumeOff } from "@fortawesome/free-solid-svg-icons";
import { fadeInVolume, fadeOutVolume } from "../utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOBRBroadcast, useOBRPlayers } from "../hooks/obr";

import { APP_KEY } from "../config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import OBR from "@owlbear-rodeo/sdk";
import { SimpleTrack } from "../types/tracks";

type TrackWithDuration = SimpleTrack & { duration?: number };
interface PlayerAudioIndicatorProps {
    playlist: string;
    globalVolume: number;
    track?: SimpleTrack;
    autoplayError: () => void;
    triggerPlayback: boolean;
}

function PlayerAudioIndicator({ 
    playlist,
    globalVolume,
    track,
    autoplayError,
    triggerPlayback
}: PlayerAudioIndicatorProps) {
    const { registerMessageHandler } = useOBRBroadcast<MessageContent>();
    const { playlistVolume, setPlaylistVolume } = usePlayerSettings();
    const audioRef = useRef<HTMLAudioElement>(null);
    
    const [ trackWithDuration, setTrackWithDuration ] = useState<TrackWithDuration|undefined>(track);
    const [ loaded, setLoaded ] = useState(false);
    const [ fading, setFading ] = useState(false);
    const [ fade, setFade ] = useState<FadeObject>();

    const setPlaybackTime = (time: number) => {
        setTrackWithDuration(old => old ? { ...old, time } : old);
    }

    const setIsPlaying = (playing: boolean) => {
        setTrackWithDuration(old => old ? { ...old, playing } : old);
    }

    const playTrack = useCallback(() => {
        audioRef.current!.play().catch((reason: DOMException) => {
            console.error(reason, reason.name);
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
        if (loaded && audioRef.current && trackWithDuration && !fading) {
            audioRef.current.volume = globalVolume * (trackWithDuration.volume ?? 0.75) * (playlistVolume ?? 0.75);
        }
    }, [globalVolume, trackWithDuration, loaded, fading, playlistVolume]);

    useEffect(() => {
        if (audioRef.current && track) {
            const timeOffset = Math.abs(audioRef.current.currentTime - track.time);
            if (timeOffset > 1) {
                audioRef.current.currentTime = track.time;
            }
        }
        setTrackWithDuration(old => {
            if (old === undefined) {
                return track;
            }
            if (old.name === track?.name && old.source === track?.source) {
                return {
                    ...track,
                    duration: old.duration
                };
            }
            setLoaded(false);
            return track;
        });
    }, [track]);

    useEffect(() => {
        if (loaded && !fading) {
            if (trackWithDuration!.playing) {
                playTrack();
            }
            else {
                audioRef.current!.pause();
            }
        }
    }, [loaded, trackWithDuration, triggerPlayback, fading, playTrack]);

    useEffect(() => {
        if (loaded) {
            setTrackWithDuration(old => old ? { ...old, duration: audioRef.current?.duration } : old );
        }
    }, [loaded]);

    useEffect(() => {
        const audioElement = audioRef.current;
        if (audioElement) {
            const handleTimeUpdate = () => {
                setPlaybackTime(audioElement.currentTime);
            };

            audioElement.addEventListener("timeupdate", handleTimeUpdate);

            return () => audioElement.removeEventListener("timeupdate", handleTimeUpdate);
        }
    }, [trackWithDuration?.name, trackWithDuration?.source]);

    useEffect(() => {
        return registerMessageHandler(`${APP_KEY}/internal`, message => {
            if (message.type === "fade") {
                const fadeObject = message.payload;
                if (fadeObject.playlist !== playlist) return;
                setFade(fadeObject);
            }
        });
    }, [playlist, registerMessageHandler]);

    useEffect(() => {
        if (fade == undefined || fade.fade != "in") return;
        if (fading || (trackWithDuration?.volume ?? 0) <= 0) return;
        
        setFading(true);
        setFade(undefined);
        const audio = audioRef.current!;
        audio.volume = 0;
        playTrack();
        setIsPlaying(true);

        const targetVolume = trackWithDuration!.volume;
        const interval = 50;
        const steps = fade.duration / interval;

        let currentStep = 0;

        const fadeAudio = setInterval(() => {
            if (currentStep < steps) {
                audio.volume = fadeInVolume(targetVolume, currentStep, steps) * globalVolume;
                currentStep++;
            } else {
                clearInterval(fadeAudio);
                setFading(false);
                setFade(undefined);
            }
        }, interval);
    }, [fade, fading, globalVolume, playTrack, trackWithDuration]);

    useEffect(() => {
        if (fade == undefined || fade.fade != "out") return;
        if (fading || (trackWithDuration?.volume ?? 0) <= 0) return;
        
        setFading(true);
        setFade(undefined);
        const audio = audioRef.current!;

        const initialVolume = trackWithDuration!.volume;
        const interval = 50;
        const steps = fade.duration / interval;

        let currentStep = 0;

        const fadeAudio = setInterval(() => {
            if (currentStep <= steps) {
                audio.volume = fadeOutVolume(initialVolume, currentStep, steps) * globalVolume;
                currentStep++;
            } else {
                audio.pause();
                setIsPlaying(false);
                clearInterval(fadeAudio);
                setFading(false);
                setFade(undefined);
            }
        }, interval);
    }, [fade, fading, globalVolume, trackWithDuration]);

    return <div key={playlist} className="audio-indicator">
        <audio src={trackWithDuration?.source} ref={audioRef} onCanPlayThrough={() => setLoaded(true)} />
        <div className="audio-indicator-top-row">
            <p style={{fontWeight: "bold"}}>{ playlist } </p>
            <div style={{ display: "flex", flexDirection: "row", alignItems: "center" }}>
                <FontAwesomeIcon icon={faVolumeHigh} style={{opacity: trackWithDuration?.playing ? 1 : 0, paddingRight: "1rem"}} />
                <div className="horizontal-volume-slider-container">
                    <Slider
                        min={0}
                        max={100}
                        value={playlistVolume * 100}
                        onChange={(_, value) => setPlaylistVolume(value as number / 100)}
                        orientation="horizontal"
                    />
                </div>
            </div>
        </div>
        <div className="progressbar-container">
            {
                trackWithDuration && 
                <Slider
                    orientation="horizontal"
                    min={0}
                    max={500}
                    value={trackWithDuration.duration ? (trackWithDuration.time / trackWithDuration.duration * 500) : 0}
                    disabled
                />
            }
        </div>
    </div>;
}

export function PlayerView() {
    const { registerMessageHandler, sendMessage } = useOBRBroadcast<MessageContent>();
    const party = useOBRPlayers();

    const [ playlists, setPlaylists ] = useState<string[]>([]);
    const [ tracks, setTracks ] = useState<Record<string, TrackWithDuration>>({});
    const [ GMIDs, setGMIDs ] = useState<string[]>([]);
    const [ setup, setSetup ] = useState(false);
    const [ volume, setVolume ] = useState(0.5);
    const [ previousVolume, setPreviousVolume ] = useState(0.5);
    const [ volumeHovered, setVolumeHovered ] = useState(false);
    const [ mute, setMute ] = useState(false);
    const [ autoplayErrorOccurred, setAutoplayErrorOccurred ] = useState(false);
    const [ triggerPlayback, setTriggerPlayback ] = useState(false);

    const toggleMute = () => {
        if (volume === 0) {
            setVolume(previousVolume);
        }
        else {
            setPreviousVolume(volume);
            setMute(true);
            setVolume(0);
        }
    }

    const restartPlayback = () => { 
        sendMessage(`${APP_KEY}/internal`, { type: "get-playlists" }, GMIDs);
        setAutoplayErrorOccurred(false); 
        setTriggerPlayback(old => !old); 
    }

    useEffect(() => {
        if (volume !== 0) {
            setMute(false);
        }
    }, [volume]);

    useEffect(() => {
        return registerMessageHandler(`${APP_KEY}/internal`, message => {
            if (message.type === "track") {
                const track = message.payload as SimpleTrack;
                setTracks(oldTracks => {
                    const prev = oldTracks[track.playlist];
                    if (prev && prev.name === track.name && prev.source == track.source) {
                        return {...oldTracks, [track.playlist]: { ...prev, ...track } }    
                    }
                    return {...oldTracks, [track.playlist]: track }
                });
            }
            else if (message.type === "playlists") {
                const newPlaylists = message.payload as string[];
                for (const playlist of newPlaylists) {
                    if (!playlists.includes(playlist)) {
                        sendMessage(`${APP_KEY}/internal`, { type: "get-track", payload: playlist }, GMIDs);
                    }
                }
                setPlaylists(newPlaylists);
            }
            else if (message.type === "fade") {
                // Handled by children
            }
            else {
                console.error(`Received invalid message of type '${message.type}':`, message);
            }
        });
    }, [GMIDs, playlists, sendMessage, registerMessageHandler]);

    useEffect(() => {
        if (!setup && party && party.length >= 1) {
            const GMs = party.filter(player => player.role === "GM");
            if (GMs.length == 0) {
                return;
            }
            const GMIDs = GMs.map(gm => gm.id);
            sendMessage(`${APP_KEY}/internal`, { type: "get-playlists" }, GMIDs);
            setSetup(true);
            setGMIDs(GMIDs);
        }
    }, [party, setup, sendMessage]);

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
                <Box sx={{ height: "7rem", pb: 1, pt: 2 }}>
                    <Slider
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
