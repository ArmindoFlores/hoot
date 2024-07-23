import React, { createContext, useContext, useEffect, useState } from "react";

import jsonTracks from "../assets/tracks.json";

export interface Track {
    name: string;
    source: string;
    playlists: string[];
};

interface TrackContextType {
    tracks: Map<string, Track[]>;
    playlists: string[];
};

const TrackContext = createContext<TrackContextType>({ tracks: new Map(), playlists: [] });
export const useTracks = () => useContext(TrackContext);

export function TrackProvider({ children }: { children: React.ReactNode }) {
    const [ tracks, setTracks ] = useState<TrackContextType["tracks"]>(new Map());
    const [ playlists, setPlaylists ] = useState<TrackContextType["playlists"]>([]);

    useEffect(() => {
        // FIXME: load tracks for real
        const tracks = new Map<string, Track[]>();
        for (const track of jsonTracks) {
            for (const playlist of track.playlists) {
                if (!tracks.has(playlist)) {
                    tracks.set(playlist, []);
                }
                tracks.get(playlist)?.push(track);
            }
        }
        setTracks(tracks);
        setPlaylists(Array.from(tracks.keys()));
    }, []);

    return <TrackContext.Provider value={{tracks, playlists}}>
        { children }
    </TrackContext.Provider>;
}
