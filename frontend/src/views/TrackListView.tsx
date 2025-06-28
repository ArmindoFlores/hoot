import { ArrowRight, DragIndicator, VolumeUp } from "@mui/icons-material";
import { AudioObject, useAudio } from "../providers/AudioPlayerProvider";
import { Box, Card, Collapse, IconButton, Input, Typography } from "@mui/material";
import { DndContext, DragEndEvent, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useCallback, useEffect, useMemo, useState } from "react";

import { APP_KEY } from "../config";
import { CSS } from "@dnd-kit/utilities";
import OBR from "@owlbear-rodeo/sdk";
import { Track } from "../types/tracks";
import { useTracks } from "../providers/TrackProvider";

const SORTED_PLAYLISTS_METADATA_KEY = `${APP_KEY}/sortedPlaylists`;

interface PlaylistItemProps {
    playlist: string;
    playingPlaylists: string[];
    playing: Record<string, AudioObject | null>;
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
        if (playing[playlist]?.track?.source !== track.source) {
            return false;
        }
        return true;
    }, [playing, playingPlaylists]);

    return <Box ref={setNodeRef} style={style} {...attributes} >
        <Card key={playlist} variant="elevation" sx={{ p: 1, mb: 1 }}>
            <Box sx={{ display: "flex", flexDirection: "row", gap: 1, cursor: "pointer", alignItems: "center", justifyContent: "space-between" }}>
                <Box onClick={() => setExpanded(old => !old) } sx={{ display: "flex", flexDirection: "row", flex: 1, gap: 1, cursor: "pointer", alignItems: "center", justifyContent: "start" }}>
                    <ArrowRight />
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

function updateSortingOrder(sortingOrder: string[], existing: string[]) {
    const toKeep = sortingOrder.filter(playlist => existing.includes(playlist));
    const toAdd = existing.filter(playlist => !sortingOrder.includes(playlist));
    return [...toKeep, ...toAdd];
}

export function TrackListView() {
    const { tracks, playlists, loadOnlineTrack } = useTracks();
    const { playing, loadTrack } = useAudio();
    const playingPlaylists = useMemo(() => Object.keys(playing), [playing]);
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    
    const [search, setSearch] = useState<string>("");
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
        const updatedTrack = await loadOnlineTrack(track);
        try {
            await loadTrack(playlist, updatedTrack.source!, updatedTrack.name, updatedTrack.id.toString());
            return;
        }
        catch (error) {
            OBR.notification.show(`Error loading track: ${(error as Error).message}`, "ERROR");
        }
    }, [loadTrack, loadOnlineTrack]);

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (over != null && active.id !== over.id && playlistSortOrder != null) {
            const items = updateSortingOrder(playlistSortOrder, playlists);
            const oldIndex = items.indexOf(active.id as string);
            const newIndex = items.indexOf(over.id as string);
            const result = arrayMove(items, oldIndex, newIndex);
            OBR.room.setMetadata({ [SORTED_PLAYLISTS_METADATA_KEY]: result });
            setPlaylistSortOrder(result);
            setSortedPlaylists(result);
        }
    }

    useEffect(() => {
        OBR.room.getMetadata().then(metadata => {
            if (metadata[SORTED_PLAYLISTS_METADATA_KEY] == undefined) return;
            setPlaylistSortOrder(metadata[SORTED_PLAYLISTS_METADATA_KEY] as string[]);
        });
    }, []);

    useEffect(() => {
        if (playlistSortOrder == null) return;
        const result = updateSortingOrder(playlistSortOrder, playlists);
        return setSortedPlaylists(result);
    }, [playlists, playlistSortOrder]);

    return <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
    >
        <SortableContext 
            items={sortedPlaylists}
            strategy={verticalListSortingStrategy}
        >
            <Box sx={{ p: 2, overflow: "auto", height: "calc(100vh - 50px)", userSelect: "none" }}>
                <Input
                    className="track-search"
                    placeholder="Enter a track name or a #playlist"
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    sx={{ width: "100%" }}
                />
                <Box sx={{ p: 1 }} />
                <Box>
                    {
                        sortedPlaylists.filter(playlist => playlistMatchesSearch(playlist)).map(playlist => {
                            return <PlaylistItem 
                                key={playlist}
                                playlist={playlist}
                                playing={playing}
                                playTrack={playTrack}
                                playingPlaylists={playingPlaylists}
                                tracks={tracks}
                                trackFilter={trackMatchesSearch}
                            />;
                        })
                    }
                </Box>
            </Box>
            </SortableContext>
    </DndContext>;
}

