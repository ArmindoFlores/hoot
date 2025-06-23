import { Box, Collapse, IconButton, Slider, Typography } from "@mui/material";
import { faVolumeHigh, faVolumeLow, faVolumeMute, faVolumeOff } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useMemo, useState } from "react";

import { AudioControls } from "../components/AudioControls";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAudio } from "../providers/AudioPlayerProvider";

export function AudioPlayerView() {
    const { playing, volume, setVolume } = useAudio();
    const playingPlaylists = useMemo(() => Object.keys(playing), [playing]);

    const [ previousVolume, setPreviousVolume ] = useState(volume); 
    const [ mute, setMute ] = useState(false);
    const [ volumeHovered, setVolumeHovered ] = useState(false);

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

    useEffect(() => {
        if (volume !== 0) {
            setMute(false);
        }
    }, [volume]);

    return <Box sx={{ overflow: "auto", maxHeight: "calc(100vh - 50px)" }}>
        <Box sx={{ p: 2, mb: 2 }}>
            <Typography variant="h5">Currently Playing</Typography>
            {
                playingPlaylists.length === 0 &&
                <Typography>
                    No tracks are playing. 
                    Go to the track list tab
                    to queue up.
                </Typography>
            }
            <Box sx={{ p: 1 }}/>
            {
                playingPlaylists.map(playlist => (
                    <Box key={playlist} className="audio-control-holder">
                        <AudioControls playlist={playlist} />
                    </Box>
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
