import { ArrowRight, Delete, VolumeUp } from "@mui/icons-material";
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

import { CSS } from "@dnd-kit/utilities";
import { Track } from "../types/tracks";
import { useTracks } from "../providers/TrackProvider";

interface PlaylistItemProps {
    playlist: string;
    playingPlaylists: string[];
    playing: Record<string, AudioObject | null>;
    tracks: Map<string, Track[]>;
    playTrack: (track: Track, playlist: string) => Promise<void>;
    trackFilter: (track: Track) => boolean;
    removeTrack: (trackName: string, playlist: string) => void;
}

function PlaylistItem({ playlist, playingPlaylists, playing, tracks, playTrack, trackFilter, removeTrack }: PlaylistItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
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
        if (playing[playlist]?.sourceURL !== track.source) {
            return false;
        }
        return true;
    }, [playing, playingPlaylists]);

    return <Box ref={setNodeRef} style={style} {...listeners} {...attributes} >
        <Card key={playlist} variant="elevation" sx={{ p: 1, mb: 1 }}>
            <Box onPointerUp={() => { if (!isDragging) { setExpanded(old => !old) } }} sx={{ display: "flex", flexDirection: "row", gap: 1, cursor: "pointer" }}>
                <ArrowRight />
                <Typography fontWeight="bold">{playlist}</Typography>
                {
                    playingPlaylists.includes(playlist) &&
                    <VolumeUp />
                }
            </Box>
            <Collapse in={expanded}>
                {
                    tracks.get(playlist)!.filter(track => trackFilter(track)).map((track, index) =>
                        <Box
                            key={index}
                            onClick={() => playTrack(track, playlist)}
                            onMouseEnter={() => setHoveredTrack(track)}
                            onMouseLeave={() => setHoveredTrack(oldTrack => oldTrack === track ? undefined : oldTrack)}
                            sx={{ display: "flex", flexDirection: "row", gap: 1, alignItems: "center" }}
                        >
                            <VolumeUp
                                sx={{
                                    paddingRight: "0.5rem",
                                    opacity: isPlayingTrack(track, playlist) ? 1 : 0
                                }}
                            />
                            <Box sx={{ display: "flex", flex: 1, flexDirection: "row", gap: 1, cursor: "pointer", alignItems: "center", justifyContent: "space-between" }}>
                                <Typography>{track.name}</Typography>
                                <IconButton disabled={hoveredTrack !== track} onClick={() => removeTrack(track.name, playlist)} sx={{ opacity: hoveredTrack === track ? 1 : 0 }}>
                                    <Delete />
                                </IconButton>
                            </Box>
                        </Box>
                    )
                }
            </Collapse>
        </Card>
    </Box>;
}

export function TrackListView() {
    const { tracks, playlists, removeTrack, loadOnlineTrack } = useTracks();
    const { playing, loadTrack } = useAudio();
    const playingPlaylists = useMemo(() => Object.keys(playing), [playing]);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { delay: 100, tolerance: 25 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    
    const [search, setSearch] = useState<string>("");
    const [ sortedPlaylists, setSortedPlaylists ] = useState(playlists);

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
        loadTrack(playlist, updatedTrack.source!, updatedTrack.name);
    }, [loadTrack, loadOnlineTrack]);

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (over != null && active.id !== over.id) {
            setSortedPlaylists((items) => {
                const oldIndex = items.indexOf(active.id as string);
                const newIndex = items.indexOf(over.id as string);

                return arrayMove(items, oldIndex, newIndex);
            });
        }
    }

    useEffect(() => {
        setSortedPlaylists(sortedPlaylists => {
            const toKeep = sortedPlaylists.filter(playlist => playlists.includes(playlist));
            const toAdd = playlists.filter(playlist => !sortedPlaylists.includes(playlist));
            return [...toKeep, ...toAdd];
        })
    }, [playlists]);

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
                                removeTrack={removeTrack}
                            />;
                        })
                    }
                </Box>
            </Box>
            </SortableContext>
    </DndContext>;
}

