import { ArrowDropDown, ArrowRight, DragIndicator, VolumeUp } from "@mui/icons-material";
import { Box, Button, Card, Collapse, IconButton, Input, Typography } from "@mui/material";
import { DndContext, DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useCallback, useEffect, useRef, useState } from "react";

import { APP_KEY } from "../config";
import { CSS } from "@dnd-kit/utilities";
import { ClientAPI } from "@armindoflores/obr-ext-core";
import { HootAudioControlsMessageRegistry } from "../types/broadcast/audioControls";
import OBR from "@owlbear-rodeo/sdk";
import { Track } from "../types/tracks";
import { constants } from "../constants";
import { logging } from "../logging";
import { manageTracksModal } from "./ManageTracksView";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { useTracks } from "../providers/TrackProvider";

const SORTED_PLAYLISTS_METADATA_KEY = `${APP_KEY}/sortedPlaylists`;

interface PlaylistItemProps {
    playlist: string;
    playingPlaylists: string[];
    playing: number | null;
    tracks: Map<string, Track[]>;
    playTrack: (track: Track, playlist: string) => Promise<void>;
    trackFilter: (track: Track) => boolean;
}

function PlaylistItem({ playlist, playingPlaylists, playing, tracks, playTrack, trackFilter }: PlaylistItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition
    } = useSortable({ id: playlist });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    const [expanded, setExpanded] = useState(false);
    const [hoveredTrack, setHoveredTrack] = useState<Track>();

    const isPlayingTrack = useCallback((track: Track, playlist: string) => {
        if (!playingPlaylists.includes(playlist)) {
            return false;
        }
        if (playing !== track.id) {
            return false;
        }
        return true;
    }, [playing, playingPlaylists]);

    return <Box ref={setNodeRef} style={style} {...attributes} >
        <Card key={playlist} variant="elevation" sx={{ p: 1, mb: 1 }}>
            <Box sx={{ display: "flex", flexDirection: "row", gap: 1, cursor: "pointer", alignItems: "center", justifyContent: "space-between" }}>
                <Box onClick={() => setExpanded(old => !old) } sx={{ display: "flex", flexDirection: "row", flex: 1, gap: 1, cursor: "pointer", alignItems: "center", justifyContent: "start" }}>
                    {
                        expanded ? <ArrowDropDown /> : <ArrowRight />
                    }
                    <Typography fontWeight="bold">{playlist}</Typography>
                    {
                        playingPlaylists.includes(playlist) &&
                        <VolumeUp />
                    }
                </Box>
                <IconButton title="Drag" {...(!expanded ? listeners : {})}>
                    <DragIndicator />
                </IconButton>
            </Box>
            <Collapse in={expanded}>
                {
                    (tracks.get(playlist) ?? []).filter(track => trackFilter(track)).map((track, index) =>
                        <Box
                            key={index}
                            onClick={() => playTrack(track, playlist)}
                            onMouseEnter={() => setHoveredTrack(track)}
                            onMouseLeave={() => setHoveredTrack(oldTrack => oldTrack === track ? undefined : oldTrack)}
                            sx={{ pl: 1, pr: 1, display: "flex", flexDirection: "row", gap: 1, alignItems: "center", backgroundColor: hoveredTrack?.id == track.id ? "rgba(0, 0, 0, 0.2)" : undefined }}
                        >
                            <VolumeUp
                                sx={{
                                    paddingRight: "0.5rem",
                                    opacity: isPlayingTrack(track, playlist) ? 1 : 0
                                }}
                            />
                            <Box 
                                sx={{
                                    display: "flex",
                                    flex: 1,
                                    flexDirection: "row",
                                    gap: 1,
                                    cursor: "pointer",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    pb: 1,
                                    pt: 1,
                                }}
                            >
                                <Typography>{track.name}</Typography>
                            </Box>
                        </Box>
                    )
                }
            </Collapse>
        </Card>
    </Box>;
}

function updateSortingOrder(sortingOrder: string[]|null, existing: string[]) {
    const toKeep = sortingOrder ? sortingOrder.filter(playlist => existing.includes(playlist)) : [];
    const toAdd = existing.filter(playlist => sortingOrder ? !sortingOrder.includes(playlist) : true);
    return [...toKeep, ...toAdd];
}

function openManageTracksPopup() {
    OBR.modal.open(manageTracksModal);
}

export function TrackListView() {
    const audioAPIClient = useRef(new ClientAPI<HootAudioControlsMessageRegistry>(
        constants.AUDIO_CONTROLLER_MESSAGE_CHANNEL_ID,
        constants.AUDIO_CONTROLLER_CLIENT_MESSAGE_CHANNEL_ID,
        "LOCAL",
    ));
    const { tracks, playlists } = useTracks();
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    
    const [search, setSearch] = useState<string>("");
    const [ playingPlaylists, setPlayingPlaylists ] = useState<string[]>([]);
    const [ playingTracks, setPlayingTracks ] = useState<Record<string, number | null>>({});
    const [ sortedPlaylists, setSortedPlaylists ] = useState<string[]>([]);
    const [ playlistSortOrder, setPlaylistSortOrder ] = useState<string[]|null>(null);

    const trackMatchesSearch = useCallback((track: Track) => {
        if (!search) {
            return true;
        }
        const splitSearch = search.split(" ");
        const realSearch = splitSearch.filter(word => !word.startsWith("#")).join(" ");
        return track.name.toLowerCase().includes(realSearch.toLowerCase());
    }, [search]);

    const playlistMatchesSearch = useCallback((playlist: string) => {
        if (!search) {
            return true;
        }
        const splitSearch = search.split(" ");
        const playlists = splitSearch.filter(word => word.startsWith("#")).map(word => word.substring(1).replace(/_/g, " ").toLowerCase());
        if (playlists.length === 0) {
            return true;
        }
        return playlists.includes(playlist.toLowerCase());
    }, [search]);

    const playTrack = useCallback(async (track: Track, playlist: string) => {
        const response = await audioAPIClient.current.request<"HOOT_PLAY_AUDIO">(
            {
                type: "HOOT_PLAY_AUDIO",
                playlist,
                track: track.id,
                playOnLoad: false,
            }
        );
        if (response.type === "ERROR") {
            logging.error(`Error loading track: ${response.error}`);
            OBR.notification.show(`Error loading track: ${response.error}`, "ERROR");
            return;
        }
        setPlayingPlaylists(old => [...old.filter(p => p !== playlist), playlist]);
        setPlayingTracks(old => ({...old, [playlist]: track.id}));
    }, []);

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (over != null && active.id !== over.id) {
            const items = updateSortingOrder(playlistSortOrder, playlists);
            const oldIndex = items.indexOf(active.id as string);
            const newIndex = items.indexOf(over.id as string);
            const result = arrayMove(items, oldIndex, newIndex);
            OBR.room.setMetadata({ [SORTED_PLAYLISTS_METADATA_KEY]: result });
            setPlaylistSortOrder(result);
            setSortedPlaylists(result);
        }
    }

    const fetchData = useCallback(() => {
        audioAPIClient.current.request<"HOOT_GET_PLAYING_INFO">(
            {type: "HOOT_GET_PLAYING_INFO"}
        ).then(response => {
            if (response.type === "ERROR") {
                logging.error("internal API error", response.error);
                return;
            }
            
            setPlayingPlaylists(Object.keys(response.playing));
            setPlayingTracks(Object.fromEntries(Object.entries(response.playing).map(([key, value]) => [
                key,
                value.trackId
            ])));
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

    useEffect(() => {
        OBR.room.getMetadata().then(metadata => {
            if (metadata[SORTED_PLAYLISTS_METADATA_KEY] == undefined) return;
            setPlaylistSortOrder(metadata[SORTED_PLAYLISTS_METADATA_KEY] as string[]);
        });
    }, []);
    
    useEffect(() => {
        const result = updateSortingOrder(playlistSortOrder, playlists);
        return setSortedPlaylists(result);
    }, [playlists, playlistSortOrder]);

    return (
        <Box
            sx={{
                width: "100vw",
                overflowY: "auto",
                height: "calc(100vh - 50px)",
                userSelect: "none",
            }}
        >
            <Box sx={{p: 2, overflowX: "hidden"}}>
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
                        <Box sx={{ display: "flex", flexDirection: "row", gap: 1 }}>
                            <Input
                                className="track-search"
                                placeholder="Enter a track name or a #playlist"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                sx={{ width: "100%" }}
                            />
                            <Button
                                variant="outlined"
                                onClick={openManageTracksPopup}
                            >
                                Manage
                            </Button>
                        </Box>
                        <Box sx={{ p: 1 }} />
                        <Box>
                            {sortedPlaylists
                                .filter((playlist) =>
                                    playlistMatchesSearch(playlist),
                                )
                                .map((playlist) => {
                                    return (
                                        <PlaylistItem
                                            key={playlist}
                                            playlist={playlist}
                                            playing={playingTracks[playlist]}
                                            playTrack={playTrack}
                                            playingPlaylists={playingPlaylists}
                                            tracks={tracks}
                                            trackFilter={trackMatchesSearch}
                                        />
                                    );
                                })}
                        </Box>
                    </SortableContext>
                </DndContext>
            </Box>
        </Box>
    );
}
