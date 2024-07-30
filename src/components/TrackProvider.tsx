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
    addTrack: (track: Track) => void;
    removeTrack: (track: string, playlist: string) => void;
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

function trackMapToArray(tracks: Map<string, Track[]>) {
    const result: Track[] = [];
    for (const trackList of tracks.values()) {
        for (const track of trackList) {
            const existing = result.find(existingTrack => existingTrack.name === track.name && existingTrack.source === track.source);
            if (existing) {
                for (const playlist of track.playlists) {
                    if (!existing.playlists.includes(playlist)) {
                        existing.playlists.push(playlist);
                    }
                }
            }
            else {
                result.push(track);
            }
        }
    }
    return result;
}

const TrackContext = createContext<TrackContextType>({
    tracks: new Map(),
    playlists: [],
    addTrack: () => {},
    removeTrack: () => {},
    importTracks: () => {},
});
export const useTracks = () => useContext(TrackContext);

export function TrackProvider({ children }: { children: React.ReactNode }) {
    const [ tracks, setTracks ] = useState<TrackContextType["tracks"]>(new Map());
    const [ playlists, setPlaylists ] = useState<TrackContextType["playlists"]>([]);

    const addTrack = useCallback((track: Track) => {
        for (const playlist of track.playlists) {
            const playlistObject = tracks.get(playlist);
            if (playlistObject != undefined) {
                const existing = playlistObject.find(existingTrack => existingTrack.name === track.name);
                if (existing === undefined) {
                    playlistObject.push(track);
                }
            }
            else {
                tracks.set(playlist, [track]);
            }
        }
        setTracks(tracks);
        setPlaylists(Array.from(tracks.keys()));
        localforage.setItem(STORAGE_KEYS.TRACKS, trackMapToArray(tracks)).then(
            () => OBR.notification.show("Added track", "SUCCESS")
        );
    }, [tracks]);

    const removeTrack = useCallback((track: string, playlist: string) => {
        const trackList = tracks.get(playlist);
        if (trackList == undefined) {
            OBR.notification.show(`Invalid playlist '${playlist}'`, "ERROR");
            return;
        }
        const newTrackList = trackList.filter(existingTrack => existingTrack.name !== track);
        if (newTrackList.length === trackList.length) {
            OBR.notification.show(`Invalid track '${track}'`, "ERROR");
            return;
        }
        tracks.set(playlist, newTrackList);
        setTracks(tracks);
        setPlaylists(Array.from(tracks.keys()));
        localforage.setItem(STORAGE_KEYS.TRACKS, trackMapToArray(tracks)).then(
            () => OBR.notification.show("Deleted track", "SUCCESS")
        );
    }, [setTracks, setPlaylists]);

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

    return <TrackContext.Provider value={{tracks, playlists, importTracks, addTrack, removeTrack}}>
        { children }
    </TrackContext.Provider>;
}
