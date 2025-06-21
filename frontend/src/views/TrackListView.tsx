import { ArrowRight, Delete, VolumeUp } from "@mui/icons-material";
import { Box, Card, Collapse, IconButton, Input, Typography } from "@mui/material";
import { Track, useTracks } from "../components/TrackProvider";
import { useCallback, useMemo, useState } from "react";

import { useAudioPlayer } from "../components/AudioPlayerProvider";

export function TrackListView() {
    const { tracks, playlists, removeTrack } = useTracks();
    const { playing, setTrack } = useAudioPlayer();
    const playingPlaylists = useMemo(() => Object.keys(playing), [playing]);

    const [ search, setSearch ] = useState<string>("");
    const [ expandedPlaylists, setExpandedPlaylists ] = useState<string[]>([]);
    const [ hoveredTrack, setHoveredTrack ] = useState<Track>();

    const toggleExpanded = useCallback((playlist: string) => {
        setExpandedPlaylists(oldList => {
            if (oldList.includes(playlist)) {
                return oldList.filter(oldPlaylist => oldPlaylist !== playlist);
            }
            return [...oldList, playlist];
        });
    }, []);

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

    const isPlayingTrack = useCallback((track: Track, playlist: string) => {
        if (!playingPlaylists.includes(playlist)) {
            return false;
        }
        if (playing[playlist].track.name !== track.name) {
            return false;
        }
        return true;
    }, [playing, playingPlaylists]);

    const playTrack = useCallback((track: Track, playlist: string) => {
        setTrack(track, playlist);
    }, [setTrack]);

    return <Box sx={{ p: 2, overflow: "auto", height: "calc(100vh - 50px)" }}>
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
                playlists.filter(playlist => playlistMatchesSearch(playlist)).map(playlist =>  {
                    const expanded = expandedPlaylists.includes(playlist);
                    return (
                        <Card key={playlist} variant="elevation" sx={{ p: 1, mb: 1 }}>
                            <Box onClick={() => toggleExpanded(playlist)} sx={{ display: "flex", flexDirection: "row", gap: 1, cursor: "pointer" }}>
                                <ArrowRight />
                                <Typography fontWeight="bold">{ playlist }</Typography>
                                {
                                    playingPlaylists.includes(playlist) &&
                                    <VolumeUp />
                                }
                            </Box>
                            <Collapse in={expanded}>
                                {
                                    tracks.get(playlist)!.filter(track => trackMatchesSearch(track)).map((track, index) => 
                                        <Box
                                            key={index}
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
                                                <Typography onClick={() => playTrack(track, playlist)}>{ track.name }</Typography>
                                                <IconButton disabled={hoveredTrack !== track} onClick={() => removeTrack(track.name, playlist)} sx={{ opacity: hoveredTrack === track ? 1 : 0 }}>
                                                    <Delete />
                                                </IconButton> 
                                            </Box>
                                        </Box>
                                    )
                                }
                            </Collapse>
                        </Card>
                    );
                })
            }
        </Box>
    </Box>;
}
