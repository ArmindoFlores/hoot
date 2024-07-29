import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import OBR from "@owlbear-rodeo/sdk";
import { STORAGE_KEYS } from "../config";
import localforage from "localforage";

export interface Track {
    name: string;
    source: string;
    playlists: string[];
};

interface TrackContextType {
    tracks: Map<string, Track[]>;
    playlists: string[];
    importTracks: (tracks: Track[]) => void;
};

function trackArrayToMap(trackList: Track[]) {
    const tracks = new Map<string, Track[]>();
    for (const track of trackList) {
        for (const playlist of track.playlists) {
            if (!tracks.has(playlist)) {
                tracks.set(playlist, []);
            }
            tracks.get(playlist)?.push(track);
        }
    }
    return tracks;
}

const TrackContext = createContext<TrackContextType>({ tracks: new Map(), playlists: [], importTracks: () => {} });
export const useTracks = () => useContext(TrackContext);

export function TrackProvider({ children }: { children: React.ReactNode }) {
    const [ tracks, setTracks ] = useState<TrackContextType["tracks"]>(new Map());
    const [ playlists, setPlaylists ] = useState<TrackContextType["playlists"]>([]);

    const importTracks = useCallback((trackList: Track[]) => {
        try {
            const tracks = trackArrayToMap(trackList);
            setTracks(tracks);
            setPlaylists(Array.from(tracks.keys()));
            localforage.setItem(STORAGE_KEYS.TRACKS, trackList);
            OBR.notification.show("Tracks imported", "SUCCESS");
        }
        catch (e) {
            console.error(e);
            OBR.notification.show("Error importing tracks", "ERROR");
        }
    }, [setTracks, setPlaylists]);

    useEffect(() => {
        localforage.getItem(STORAGE_KEYS.TRACKS).then(stored => {
            if (stored == null) {
                return;
            }
            try {
                const tracks = trackArrayToMap(stored as Track[]);
                setTracks(tracks);
                setPlaylists(Array.from(tracks.keys()));
            }
            catch (e) {
                console.error(e);
                OBR.notification.show("Error loading tracks", "ERROR");
            }
        });
    }, []);

    return <TrackContext.Provider value={{tracks, playlists, importTracks}}>
        { children }
    </TrackContext.Provider>;
}
