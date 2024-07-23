import { Track, useTracks } from "../components/TrackProvider";
import { useCallback, useState } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCaretRight } from "@fortawesome/free-solid-svg-icons";

export function TrackListView() {
    const { tracks, playlists } = useTracks();

    const [ search, setSearch ] = useState<string>();
    const [ expandedPlaylists, setExpandedPlaylists ] = useState<string[]>([]);

    const toggleExpanded = useCallback((playlist: string) => {
        setExpandedPlaylists(oldList => {
            if (oldList.includes(playlist)) {
                return oldList.filter(oldPlaylist => oldPlaylist !== playlist);
            }
            return [...oldList, playlist];
        });
    }, [expandedPlaylists]);

    const matchesSearch = useCallback((track: Track) => {
        if (!search) {
            return true;
        }
        const splitSearch = search.split(" ");
        const playlists = splitSearch.filter(word => word.startsWith("#")).map(word => word.substring(1).toLowerCase());
        const realSearch = splitSearch.filter(word => !word.startsWith("#")).join(" ");
        
        let found = false;
        for (const playlist of playlists) {
            if (track.playlists.map(name => name.toLowerCase()).includes(playlist)) {
                found = true;
                break;
            }
        }
        if (!found) {
            return false;
        }
        return track.name.toLowerCase().includes(realSearch.toLowerCase());
    }, [search]);

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
                    playlists.map(playlist =>  {
                        const expanded = expandedPlaylists.includes(playlist);
                        return (
                            <div key={playlist} className="playlist-item">
                                <div className="playlist-title" onClick={() => toggleExpanded(playlist)}>
                                    <FontAwesomeIcon className={"caret " + (expanded ? "rotated" : "")} icon={faCaretRight} />
                                    <p className="playlist-name">{ playlist }</p>
                                </div>
                                <div className={"playlist-body " + (expanded ? "visible" : "invisible")}>
                                    {
                                        expanded &&
                                        tracks.get(playlist)!.filter(track => matchesSearch(track)).map((track, index) => 
                                            <div key={index} className="track-info">
                                                { track.name } 
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
