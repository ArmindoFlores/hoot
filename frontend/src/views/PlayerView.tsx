import { Box, Button, Card, Collapse, IconButton, Slider, Typography } from "@mui/material";
import { PlayerSettingsProvider, usePlayerSettings } from "../providers/PlayerSettingsProvider";
import { faVolumeHigh, faVolumeLow, faVolumeMute, faVolumeOff } from "@fortawesome/free-solid-svg-icons";
import { useCallback, useEffect, useMemo, useState } from "react";

import { FadeMessagePayload } from "../types/messages";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { PlayerTrack } from "../types/tracks";

interface PlayerAudioIndicatorProps {
    playlist: string;
    globalVolume: number;
    referenceTrack?: PlayerTrack;
    autoplayError: () => void;
    triggerPlayback: number;
}

function PlayerAudioIndicator({ 
    playlist,
    referenceTrack,
    autoplayError,
    triggerPlayback
}: PlayerAudioIndicatorProps) {
    const { playlistVolume, setPlaylistVolume } = usePlayerSettings();
    
    const [ track, setTrack ] = useState(referenceTrack);
    const [ duration, setDuration ] = useState<number|null>(null);
    const [ position, setPosition ] = useState<number|null>(track?.position ?? null);
    const [ fadeInQueue, setFadeInQueue ] = useState<FadeMessagePayload[]>([]);
    const [ loading, setLoading ] = useState(false);
    const [ fading, setFading ] = useState(false);

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
    const [ volume, setVolume ] = useState(1);
    const [ tracks, setTracks ] = useState<Record<string, PlayerTrack>>({});
    const [ previousVolume, setPreviousVolume ] = useState(volume);
    const [ volumeHovered, setVolumeHovered ] = useState(false);
    const [ mute, setMute ] = useState(false);
    const [ autoplayErrorOccurred, setAutoplayErrorOccurred ] = useState(false);
    const [ triggerPlayback, setTriggerPlayback ] = useState(0);

    const playlists = useMemo(() => Object.keys(tracks), [tracks]);

    const autoplayError = useCallback(() => {
        setAutoplayErrorOccurred(true);
    }, []);

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
                            referenceTrack={tracks[playlist]}
                            globalVolume={volume}
                            triggerPlayback={triggerPlayback}
                            autoplayError={autoplayError} 
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
