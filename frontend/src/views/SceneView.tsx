import { AUTOPLAY_METADATA_KEY, AutoplayList } from "../components/Autoplay";
import { Box, Button, Card, IconButton, Input, Slider, Switch, Typography } from "@mui/material";
import { faAdd, faClose, faRepeat, faSave } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import OBR from "@owlbear-rodeo/sdk";
import RepeatSelf from "../assets/repeat-self.svg";
import { useOBRBase } from "../hooks/obr";
import { useTracks } from "../providers/TrackProvider";

interface AutoplayPlaylistItemProps {
    autoplayEntry: AutoplayList[number];
    setAutoplayEntry: (entry: AutoplayList[number]) => void;
    setAutoplay: React.Dispatch<React.SetStateAction<AutoplayList>>;
}

function AutoplayPlaylistItem({ autoplayEntry, setAutoplayEntry, setAutoplay }: AutoplayPlaylistItemProps) {
    const { tracks, playlists } = useTracks();

    const [ playlist, setPlaylist ] = useState(autoplayEntry.playlist);
    const [ track, setTrack ] = useState(autoplayEntry.track);
    const [ shuffle, setShuffle ] = useState(autoplayEntry.shuffle);
    const [ fadeIn, setFadeIn ] = useState(autoplayEntry.fadeIn);
    const [ repeatMode, setRepeatMode ] = useState(autoplayEntry.repeatMode);
    const [ volume, setVolume ] = useState(autoplayEntry.volume ?? 0.75);

    const nextRepeatMode = () => {
        if (repeatMode === "no-repeat") {
            setRepeatMode("repeat-all");
        }
        else if (repeatMode === "repeat-all") {
            setRepeatMode("repeat-self");
        }
        else {
            setRepeatMode("no-repeat");
        }
    }

    const handleClose = () => {
        setAutoplay(old => {
            const arr = old.filter(item => item != autoplayEntry)
            OBR.scene.setMetadata({
                [AUTOPLAY_METADATA_KEY]: arr.length > 0 ? arr : undefined
            });
            return arr;
        });
    }

    const handleSave = () => {
        setAutoplayEntry({ playlist, track, shuffle, fadeIn, repeatMode, volume });
    }

    return <Card variant="elevation" sx={{ pl: 2, pr: 2, pt: 1, pb: 3, mb: 1, position: "relative" }}>
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "end", justifyContent: "space-between" }}>
            <label>Playlist name</label>
            <Input
                className={`small-input ${playlists.includes(playlist) ? "" : "invalid-value"}`}
                value={playlist}
                placeholder="playlist name"
                onChange={(event) => setPlaylist(event.target.value)}
            />
        </Box>
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "end", justifyContent: "space-between" }}>
            <label>Track name</label>
            <Input
                className={`small-input ${
                    (track == "" || tracks.get(playlist)?.map?.(track => track.name)?.includes?.(track))
                    ? "" : "invalid-value"
                }`}
                value={track}
                placeholder="track name"
                onChange={(event) => setTrack(event.target.value)}
            />
        </Box>
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "end", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <label>Shuffle</label>
                <Switch checked={shuffle} onChange={(value) => setShuffle(value.target.checked)} />
            </Box>
            <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <label>Fade in</label>
                <Switch checked={fadeIn} onChange={(value) => setFadeIn(value.target.checked)} />
            </Box>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "end", justifyContent: "space-between", gap: 2 }}>
            <Box sx={{ display: "flex", flex: 1, gap: 2, flexDirection: "row", alignItems: "center", justifyContent: "left" }}>
                <label style={{paddingRight: "0.5rem"}}>Repeat mode</label>
                <IconButton 
                    size="small"
                    sx={{opacity: repeatMode === "no-repeat" ? 0.5 : 1}}
                    onClick={nextRepeatMode}
                >
                    {
                        repeatMode === "repeat-self" ? 
                        <Box component="img" src={RepeatSelf} sx={{ userSelect: "none", width: "1.1rem" }} />
                        : <FontAwesomeIcon icon={faRepeat} />
                    }
                </IconButton>
            </Box>
            <Box sx={{ display: "flex", flex: 1, gap: 2, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{paddingRight: "0.5rem"}}>Volume</label>
                <Slider value={volume * 100} onChange={(_, value) => setVolume(value as number / 100)}/>
            </Box>
        </Box>
        <IconButton 
            sx={{ position: "absolute", top: 0, right: 0 }}
            size="small"
            onClick={handleClose}
        >
            <FontAwesomeIcon icon={faClose} />
        </IconButton>
        <IconButton 
            sx={{ position: "absolute", bottom: 0, right: 0 }}
            size="small"
            onClick={handleSave}
        >
            <FontAwesomeIcon icon={faSave} />
        </IconButton>
    </Card>;
}

export function SceneView() {
    const { sceneReady } = useOBRBase();
    const [ autoplay, setAutoplay ] = useState<AutoplayList>([]);

    const addNewPlaylist = () => {
        setAutoplay([
            ...autoplay, 
            { 
                playlist: "", 
                track: "", 
                volume: 0.75, 
                shuffle: true, 
                fadeIn: true, 
                repeatMode: "repeat-all" 
            }
        ]);
    }

    const setAutoplayEntry = (entry: AutoplayList[number], index: number) => {
        setAutoplay(old => {
            old.splice(index, 1, entry);
            OBR.scene.setMetadata({
                [AUTOPLAY_METADATA_KEY]: old
            });
            return old;
        });
    }

    useEffect(() => {
        OBR.scene.getMetadata().then(sceneMetadata => {
            const autoplay = sceneMetadata[AUTOPLAY_METADATA_KEY] as (AutoplayList|undefined);
            setAutoplay(autoplay ?? []);
        });
    }, []);

    return <Box sx={{ p: 2, overflow: "auto", height: "calc(100vh - 50px)" }}>
        <Typography variant="h5">Autoplay</Typography>
        <Box sx={{ p: 1 }} />
        {
            sceneReady ? (<>
            {
                autoplay.length == 0 && 
                <Typography>
                    Currently, this scene has no defined playlist(s) to autoplay.
                    Use the "Add Playlist" button to add one.
                </Typography>
            }
            {
                autoplay.map((autoplayEntry, index) => (
                    <AutoplayPlaylistItem 
                        key={index}
                        autoplayEntry={autoplayEntry}
                        setAutoplayEntry={(entry: AutoplayList[number]) => setAutoplayEntry(entry, index)}
                        setAutoplay={setAutoplay}
                    />
                ))
            }
            <Box sx={{ p: 1 }} />
            <Box>
                <Button variant="outlined" onClick={addNewPlaylist}>
                    <FontAwesomeIcon icon={faAdd} style={{marginRight: "0.5rem"}} /> Add Playlist
                </Button>
            </Box>
            </>) :
            <Typography>
                No scene loaded.
            </Typography>
        }
    </Box>;
}
