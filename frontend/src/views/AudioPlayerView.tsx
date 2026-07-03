import { Box, Collapse, IconButton, Slider, Typography } from "@mui/material";
import { DndContext, DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { faVolumeHigh, faVolumeLow, faVolumeMute, faVolumeOff } from "@fortawesome/free-solid-svg-icons";
import { useCallback, useEffect, useRef, useState } from "react";

import { APP_KEY } from "../config";
import { AudioControls } from "../components/AudioControls";
import { ClientAPI } from "@armindoflores/obr-ext-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { HootAudioControlsMessageRegistry } from "../types/broadcast/audioControls";
import OBR from "@owlbear-rodeo/sdk";
import { constants } from "../constants";
// import { loadPreviousTrackList } from "../providers/AudioPlayerProvider";
import { logging } from "../logging";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { useThrottled } from "../hooks";

const SORTED_PLAYLISTS_METADATA_KEY = `${APP_KEY}/sortedPlayingPlaylists`;

function updateSortingOrder(sortingOrder: string[]|null, existing: string[]) {
    const toKeep = sortingOrder ? sortingOrder.filter(playlist => existing.includes(playlist)) : [];
    const toAdd = existing.filter(playlist => sortingOrder ? !sortingOrder.includes(playlist) : true);
    return [...toKeep, ...toAdd];
}

// function findTrack(trackId: number, tracks: Map<string, Track[]>) {
//     for (const trackList of tracks.values()) {
//         const track = trackList.find(t => t.id === trackId);
//         if (track != undefined) {
//             return track;
//         }
//     }
//     return undefined;
// }

export function AudioPlayerView() {
    const audioAPIClient = useRef(new ClientAPI<HootAudioControlsMessageRegistry>(
        constants.AUDIO_CONTROLLER_MESSAGE_CHANNEL_ID,
        constants.AUDIO_CONTROLLER_CLIENT_MESSAGE_CHANNEL_ID,
        "LOCAL",
    ));
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const [ previousVolume, setPreviousVolume ] = useState(1); 
    const [ volume, _setVolume ] = useState(1); 
    const [ mute, setMute ] = useState(false);
    const [ volumeHovered, setVolumeHovered ] = useState(false);
    const [ playingPlaylists, setPlayingPlaylists ] = useState<string[]>([]);
    const [ sortedPlaylists, setSortedPlaylists ] = useState<string[]>([]);
    const [ playlistSortOrder, setPlaylistSortOrder ] = useState<string[]|null>(null);
    // const [ previouslyPlaying, setPreviouslyPlaying ] = useState<SerializedTrack[]|null>(null);

    const _setVolumeThrottled = useThrottled(useCallback(async (volume: number) => {
        const response = await audioAPIClient.current.request<"HOOT_SET_GLOBAL_VOLUME">(
            {type: "HOOT_SET_GLOBAL_VOLUME", volume}
        );
        if (response.type === "ERROR") {
            throw new Error(response.error);
        }
    }, []), 250, "trailing");

    const setVolume = useCallback((volume: number) => {
        _setVolume(volume);
        _setVolumeThrottled(volume);
    }, [_setVolumeThrottled]);

    const toggleMute = useCallback(() => {
        if (volume === 0) {
            setVolume(previousVolume);
        }
        else {
            setPreviousVolume(volume);
            setMute(true);
            setVolume(0);
        }
    }, [previousVolume, setVolume, volume]);

    const unloadPlaylist = useCallback((playlist: string) => {
        setPlayingPlaylists(old => old.filter(p => p !== playlist));
    }, []);

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (over != null && active.id !== over.id) {
            const items = updateSortingOrder(playlistSortOrder, playingPlaylists);
            const oldIndex = items.indexOf(active.id as string);
            const newIndex = items.indexOf(over.id as string);
            const result = arrayMove(items, oldIndex, newIndex);
            OBR.room.setMetadata({ [SORTED_PLAYLISTS_METADATA_KEY]: result });
            setPlaylistSortOrder(result);
            setSortedPlaylists(result);
        }
    }

    // const restorePreviouslyPlaying = useCallback(async () => {
    //     const loadedTrackPromises: [SerializedTrack, Promise<Track>][] = [];
    //     for (const serializedTrack of previouslyPlaying ?? []) {
    //         const track = findTrack(serializedTrack.trackId, tracks);
    //         if (track == undefined) continue;
    //         loadedTrackPromises.push([serializedTrack, track.source == undefined || expired(track.source_expiration) ? loadOnlineTrack(track) : Promise.resolve(track)]);
    //     }

    //     const values = await Promise.allSettled(loadedTrackPromises.map(v => v[1]));
    //     const loadedTracks = values.map((value, idx) => (
    //         [loadedTrackPromises[idx][0], value.status === "rejected" ? null : value.value] as [SerializedTrack, Track|null]
    //     )).filter(value => value[1] != null && value[1].source != undefined) as [SerializedTrack, Track][];
        
    //     logging.info("Loaded tracks", loadedTracks);
    //     for (const [serializedTrack, loadedTrack] of loadedTracks) {
    //         loadTrack(
    //             serializedTrack.channelId, 
    //             loadedTrack.source!, 
    //             loadedTrack.name, 
    //             String(serializedTrack.trackId), 
    //             serializedTrack.shuffle, 
    //             serializedTrack.repeatMode
    //         ).then(audio => {
    //             audio.audioElements.gain.gain.setValueAtTime(serializedTrack.volume, 0);
    //             audio.audioElements.audio.currentTime = serializedTrack.position;
    //             if (serializedTrack.playing) {
    //                 audio.audioElements.audio.play();
    //             }
    //         });
    //     }
    // }, [loadOnlineTrack, loadTrack, previouslyPlaying, tracks]);

    const fetchData = useCallback(() => {
        // Get global info
        audioAPIClient.current.request<"HOOT_GET_GLOBAL_INFO">(
            {type: "HOOT_GET_GLOBAL_INFO"},
        ).then(response => {
            if (response.type === "ERROR") {
                logging.error("internal API error", response.error);
                return;
            }
            setPreviousVolume(response.volume);
            _setVolume(response.volume);
        });

        // Get currently playing
        audioAPIClient.current.request<"HOOT_GET_PLAYING_INFO">(
            {type: "HOOT_GET_PLAYING_INFO"}
        ).then(response => {
            if (response.type === "ERROR") {
                logging.error("internal API error", response.error);
                return;
            }
            setPlayingPlaylists(Object.keys(response.playing));
        });
    }, []);

    useEffect(() => {
        fetchData();
        
        window.addEventListener("focus", fetchData);
        const intervalId = setInterval(fetchData, 5000);

        return () => {
            window.removeEventListener("focus", fetchData);
            clearTimeout(intervalId);
        }
    }, [fetchData]);

    // useEffect(() => {
    //     const previouslyPlaying = loadPreviousTrackList();
    //     if (previouslyPlaying == null) return;
    //     setPreviouslyPlaying(previouslyPlaying.tracks);
    // }, []);

    useEffect(() => {
        if (volume !== 0) {
            setMute(false);
        }
    }, [volume]);

    useEffect(() => {
        OBR.room.getMetadata().then(metadata => {
            if (metadata[SORTED_PLAYLISTS_METADATA_KEY] == undefined) return;
            setPlaylistSortOrder(metadata[SORTED_PLAYLISTS_METADATA_KEY] as string[]);
        });
    }, []);

    useEffect(() => {
        const result = updateSortingOrder(playlistSortOrder, playingPlaylists);
        return setSortedPlaylists(result);
    }, [playingPlaylists, playlistSortOrder]);

    return <Box sx={{ overflowY: "auto", overflowX: "hidden", height: "calc(100vh - 50px)" }}>
        <Box sx={{ p: 2, mb: 2 }}>
            <Typography variant="h5">Currently Playing</Typography>
            {
                playingPlaylists.length === 0 && <Box>
                    <Typography>
                        No tracks are playing. 
                        Go to the track list tab
                        to queue up.
                    </Typography>
                    <Box sx={{ p: 1 }} />
                    {/* {
                        previouslyPlaying != null && previouslyPlaying.length > 0 &&
                        <Button variant="outlined" onClick={() => restorePreviouslyPlaying()}>
                            Restore Previously Playing
                        </Button>
                    } */}
                </Box>
            }
            <Box sx={{ p: 1 }}/>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
                modifiers={[restrictToWindowEdges]}
            >
                <SortableContext 
                    items={sortedPlaylists}
                    strategy={verticalListSortingStrategy}
                >
                    {
                        sortedPlaylists.map(playlist => (
                            <Box key={playlist} className="audio-control-holder">
                                <AudioControls playlist={playlist} unload={() => unloadPlaylist(playlist)} />
                            </Box>
                        ))
                    }
                </SortableContext>
            </DndContext>
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
