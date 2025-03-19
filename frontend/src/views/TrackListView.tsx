import { Track, useTracks } from "../components/TrackProvider";
import { faCaretRight, faTrash, faVolumeHigh } from "@fortawesome/free-solid-svg-icons";
import { useCallback, useMemo, useState } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
    }, [expandedPlaylists]);

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
        if (playing[playlist].track !== track) {
            return false;
        }
        return true;
    }, [playing]);

    const playTrack = useCallback((track: Track, playlist: string) => {
        setTrack(track, playlist);
    }, [setTrack]);

    return <div className="track-list">
        <input 
            className="track-search"
            placeholder="Enter a track name or a #playlist" 
            value={search}
            onChange={event => setSearch(event.target.value)}
        />
        <div className="track-display">
            <div className="track-display-inner">
                {
                    playlists.filter(playlist => playlistMatchesSearch(playlist)).map(playlist =>  {
                        const expanded = expandedPlaylists.includes(playlist);
                        return (
                            <div key={playlist} className="playlist-item">
                                <div className="playlist-title" onClick={() => toggleExpanded(playlist)}>
                                    <FontAwesomeIcon className={"caret " + (expanded ? "rotated" : "")} icon={faCaretRight} />
                                    <p className="playlist-name">{ playlist }</p>
                                    {
                                        playingPlaylists.includes(playlist) &&
                                        <FontAwesomeIcon icon={faVolumeHigh} />
                                    }
                                </div>
                                <div className={"playlist-body " + (expanded ? "visible" : "invisible")}>
                                    {
                                        expanded &&
                                        tracks.get(playlist)!.filter(track => trackMatchesSearch(track)).map((track, index) => 
                                            <div
                                                key={index} 
                                                className="track-info"
                                                onMouseEnter={() => setHoveredTrack(track)}
                                                onMouseLeave={() => setHoveredTrack(oldTrack => oldTrack === track ? undefined : oldTrack)}
                                            >
                                                <FontAwesomeIcon 
                                                    icon={faVolumeHigh} 
                                                    style={{
                                                        paddingRight: "0.5rem", 
                                                        opacity: isPlayingTrack(track, playlist) ? 1 : 0
                                                    }} 
                                                />
                                                <div className="track-info-right">
                                                    <p onClick={() => playTrack(track, playlist)}>{ track.name }</p>
                                                    <FontAwesomeIcon 
                                                        icon={faTrash} 
                                                        onClick={() => removeTrack(track.name, playlist)} 
                                                        style={{ opacity: hoveredTrack === track ? 1 : 0 }}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    }
                                </div>
                            </div>
                        );
                    })
                }
            </div>
        </div>
    </div>;
}
