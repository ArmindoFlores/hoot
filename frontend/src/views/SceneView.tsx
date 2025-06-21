import { Box, Button, Card, IconButton, Input, Slider, Switch, Typography } from "@mui/material";
import { RepeatMode, useAudioPlayer } from "../components/AudioPlayerProvider";
import { faAdd, faClose, faRepeat, faSave } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState } from "react";
import { useOBRBase, useOBRBroadcast } from "../hooks/obr";

import { APP_KEY } from "../config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import OBR from "@owlbear-rodeo/sdk";
import RepeatSelf from "../assets/repeat-self.svg";
import { useSettings } from "../components/SettingsProvider";
import { useTracks } from "../components/TrackProvider";

type AutoplayList = {
    playlist: string;
    track: string;
    volume: number;
    shuffle: boolean;
    fadeIn: boolean;
    repeatMode: RepeatMode;
}[];

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
                [`${APP_KEY}/autoplay`]: arr.length > 0 ? arr : undefined
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
                <Slider value={volume} onChange={(_, value) => setVolume(value as number)}/>
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
    const { tracks, playlists } = useTracks();
    const { setPlaylist, playing } = useAudioPlayer();
    const { stopOtherTracks, enableAutoplay } = useSettings();
    const { sceneReady } = useOBRBase();
    const { sendMessage } = useOBRBroadcast();

    const [ autoplay, setAutoplay ] = useState<AutoplayList>([]);
    const [ playlistsToFadeIn, setPlaylistsToFadeIn ] = useState<{ playlist: string, track: string }[]>([]);
    const [ triggerAutoplay, setTriggerAutoplay ] = useState(false);
    const [ hasAutoplayed, setHasAutoplayed ] = useState(false);

    const disableAutoplay = () => {
        setTriggerAutoplay(false);
        setHasAutoplayed(true);
    }

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
                [`${APP_KEY}/autoplay`]: old
            });
            return old;
        });
    }

    // useEffect(() => {
    //     const autoplay = sceneMetadata[`${APP_KEY}/autoplay`] as (AutoplayList|undefined);
    //     setAutoplay(autoplay ?? []);
    //     setPlaylistsToFadeIn([]);
    //     if (enableAutoplay && autoplay && autoplay.length) {
    //         setTriggerAutoplay(true);
    //     }
    // }, [enableAutoplay]);

    useEffect(() => {
        if (!sceneReady) {
            disableAutoplay();
        }
        else {
            setHasAutoplayed(false);
        }
    }, [sceneReady]);

    useEffect(() => {
        // Start autoplay if it is setup
        if (sceneReady && autoplay != undefined && triggerAutoplay && !hasAutoplayed) {
            const playlistsToFadeIn: { playlist: string, track: string }[] = [];
            disableAutoplay();

            for (const autoplayPlaylist of autoplay) {
                const trackList = tracks.get(autoplayPlaylist.playlist);
                if (trackList === undefined) {
                    OBR.notification.show(`Could not find playlist "${autoplayPlaylist.playlist}" to autoplay`, "ERROR");
                    continue;
                }
                // If a track was chosen, play that track. Else, if shuffling, play a random track.
                // Otherwise, play the first track of the track list.
                const index = autoplayPlaylist.shuffle ? Math.floor(Math.random() * trackList.length) : 0;
                const currentlyPlaying = playing[autoplayPlaylist.playlist];
                const track = autoplayPlaylist.track !== "" ? trackList.find(option => option.name === autoplayPlaylist.track) : (currentlyPlaying ? currentlyPlaying.track : trackList[index]);
                if (track === undefined) {
                    OBR.notification.show(`Could not find track "${autoplayPlaylist.track}" to autoplay`, "ERROR");
                    continue;
                }
                const isSameTrack = currentlyPlaying && (currentlyPlaying.track.name === autoplayPlaylist.track || autoplayPlaylist.track === "");
                const canFadeIn = (!isSameTrack || currentlyPlaying.playing === false) && autoplayPlaylist.fadeIn;
                setPlaylist(
                    autoplayPlaylist.playlist,
                    {
                        track,
                        playing: !canFadeIn,  // For fade-in, we send a message later
                        time: (isSameTrack ? currentlyPlaying?.time : 0) ?? 0,
                        shuffle: autoplayPlaylist.shuffle,
                        loaded: (isSameTrack ? currentlyPlaying?.loaded : false) ?? false,
                        repeatMode: autoplayPlaylist.repeatMode,
                        volume: autoplayPlaylist.volume,
                        duration: isSameTrack ? currentlyPlaying?.duration : undefined
                    }
                );
                if (canFadeIn) {
                    playlistsToFadeIn.push({
                        track: autoplayPlaylist.track,
                        playlist: autoplayPlaylist.playlist
                    });
                }
            }

            //  After this render, fade in the missing playlists 
            setPlaylistsToFadeIn(playlistsToFadeIn);

            if (stopOtherTracks) {
                for (const playlist of playlists) {
                    // If it this playlist will be set by us, do nothing here
                    if (autoplay.map(ap => ap.playlist).includes(playlist)) continue;

                    // Else, fade it out
                    const currentlyPlaying = playing[playlist];
                    if (currentlyPlaying == undefined) continue;
                    sendMessage(
                        `${APP_KEY}/internal`,
                        { 
                            type: "fade",
                            payload: {
                                fade: "out",
                                playlist
                            }
                        }, 
                        undefined,
                        "LOCAL"
                    );
                }
            }
        }
    }, [sceneReady, playing, playlists, sendMessage, setPlaylist, stopOtherTracks, tracks, triggerAutoplay, autoplay, hasAutoplayed]);

    useEffect(() => {
        // This will run after entering a new scene, and after the initial track
        // setup is performed, so that all playlists are ready to fade in.
        if (playlistsToFadeIn.length) {
            const startedPlaylists: string[] = [];
            for (const { playlist, track } of playlistsToFadeIn) {
                const playingPlaylist = playing[playlist];
                if (
                    playingPlaylist?.playing === undefined ||
                    playingPlaylist.playing ||
                    (track != "" && playingPlaylist.track.name !== track) ||
                    !playingPlaylist.loaded
                ) {
                    continue;
                }
                sendMessage(
                    `${APP_KEY}/internal`,
                    {
                        type: "fade",
                        payload: {
                            fade: "in",
                            playlist
                        }
                    }, 
                    undefined,
                    "LOCAL"
                );
                startedPlaylists.push(playlist);
            }
            const newPlaylists = playlistsToFadeIn.filter(({ playlist }) => !startedPlaylists.includes(playlist))
            if (newPlaylists.length < playlistsToFadeIn.length) {
                setPlaylistsToFadeIn(newPlaylists);
            }
        }
    }, [playlistsToFadeIn, playing, sendMessage]);

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
