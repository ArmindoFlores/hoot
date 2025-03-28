/* eslint-disable react-refresh/only-export-components */

import { APP_KEY, STORAGE_KEYS } from "../config";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiService, isError } from "../services/apiService";

import OBR from "@owlbear-rodeo/sdk";
import baselocalforage from "localforage";
import { useAuth } from "./AuthProvider";

export interface Track {
    name: string;
    source: string;
    playlists: string[];
    id?: number;
    source_expiration?: number;
}

interface TrackContextType {
    tracks: Map<string, Track[]>;
    playlists: string[];
    hasLocalTracks: boolean;
    addTrack: (track: Track & { file?: File }) => void;
    removeTrack: (track: string, playlist: string) => void;
    importTracks: (tracks: Track[]) => void;
    updateTrack: (track: Track) => void;
    reload: () => void;
    purgeLocalTracks: () => void;
}

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
    hasLocalTracks: false,
    addTrack: () => {},
    removeTrack: () => {},
    importTracks: () => {},
    updateTrack: () => {},
    reload: () => {},
    purgeLocalTracks: () => {},
});
export const useTracks = () => useContext(TrackContext);

if (window[APP_KEY] === undefined) {
    window[APP_KEY] = {};
}
window[APP_KEY].localforage = baselocalforage;

export function TrackProvider({ children, proxy }: { children: React.ReactNode, proxy: boolean }) {
    const [ tracks, setTracks ] = useState<TrackContextType["tracks"]>(new Map());
    const [ playlists, setPlaylists ] = useState<TrackContextType["playlists"]>([]);
    const [ triggerReload, setTriggerReload ] = useState(0);
    const [ hasLocalTracks, setHasLocalTracks ] = useState(false);
    const { status } = useAuth();

    const flocalforage = useCallback(() => {
        if (proxy) {
            return window.opener[APP_KEY]?.localforage as (typeof baselocalforage) | undefined;
        }
        return window[APP_KEY]?.localforage;
    }, [proxy]);
    const localforage = flocalforage();

    const addTrack = useCallback((track: Track & { file?: File }) => {
        const doWork = (track: Track & { file?: File }) => {
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
        }

        if (status === "LOGGED_OUT") {
            if (localforage == undefined) return;
            doWork(track);
            localforage.setItem(STORAGE_KEYS.TRACKS, trackMapToArray(tracks)).then(
                () => OBR.notification.show("Added track", "SUCCESS")
            );
        }
        if (status === "LOGGED_IN") {
            apiService.addTrack(track.name, track.playlists, track.file!).then(result => {
                if (isError(result)) {
                    throw new Error(result.error);
                }
                doWork(result as Track);
                OBR.notification.show("Added track", "SUCCESS");
            }).catch((error: Error) => {
                console.error(error);
                OBR.notification.show(`Couldn't add track (${error.message})`, "ERROR");
            });
        }
    }, [tracks, localforage, status]);

    const removeTrack = useCallback((track: string, playlist: string) => {
        const update = (trackList: Track[]) => {
            const newTrackList = trackList.filter(existingTrack => existingTrack.name !== track);
            if (newTrackList.length === trackList.length) {
                OBR.notification.show(`Invalid track '${track}'`, "ERROR");
                return;
            }
            tracks.set(playlist, newTrackList);
            setTracks(tracks);
            setPlaylists(Array.from(tracks.keys()));
        }

        if (status === "LOGGED_OUT") {
            if (localforage == undefined) return;
            const trackList = tracks.get(playlist);
            if (trackList == undefined) {
                OBR.notification.show(`Invalid playlist '${playlist}'`, "ERROR");
                return;
            }
            update(trackList);
            localforage.setItem(STORAGE_KEYS.TRACKS, trackMapToArray(tracks)).then(
                () => OBR.notification.show("Deleted track", "SUCCESS")
            );
        }
        if (status === "LOGGED_IN") {
            const trackList = tracks.get(playlist);
            if (trackList == undefined) return;

            const trackObj = trackList.find(t => t.name === track);
            if (trackObj == undefined) return;
            apiService.deleteTrack(
                trackObj.id!,
                playlist
            ).then(result => {
                if (isError(result)) {
                    throw new Error(result.error);
                }
                OBR.notification.show("Deleted track", "SUCCESS");
                update(trackList);
            }).catch((error: Error) => {
                OBR.notification.show(`Couldn't delete track (${error.message})`, "ERROR");
            });
        }
    }, [tracks, setTracks, setPlaylists, localforage, status]);
    
    const importTracks = useCallback((trackList: Track[]) => {
        if (localforage == undefined || status === "LOGGED_IN") return;
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
    }, [status, setTracks, setPlaylists, localforage]);

    const updateTrack = useCallback((track: Track) => {
        if (status === "LOGGED_OUT" || track.id == undefined) return;
        for (const trackList of tracks.values()) {
            for (const existingTrack of trackList) {
                if (existingTrack.id === track.id) {
                    existingTrack.name = track.name;
                    existingTrack.source = track.source;
                    existingTrack.source_expiration = track.source_expiration;
                    console.log("Updated track!")
                }
            }
        }
        setTracks(tracks);
    }, [status, tracks]);

    const reload = useCallback(() => {
        setTriggerReload(previous => previous + 1);
    }, []);

    const purgeLocalTracks = useCallback(() => {
        if (localforage == undefined) return;

        localforage.removeItem(STORAGE_KEYS.TRACKS);
        OBR.notification.show("Local tracks removed", "SUCCESS");
        reload();
    }, [localforage, reload]);

    useEffect(() => {
        if (localforage == undefined) return;
        localforage.getItem(STORAGE_KEYS.TRACKS).then(stored => {
            if (stored == null) {
                setHasLocalTracks(false);
                return;
            }
            if ((stored as Track[]).length > 0) {
                setHasLocalTracks(true);
            }
            else {
                setHasLocalTracks(false);
            }
        })
    }, [tracks, localforage]);

    useEffect(() => {
        if (status == "LOGGED_IN" || localforage == undefined) return;
        let cancelled = false;

        localforage.getItem(STORAGE_KEYS.TRACKS).then(stored => {
            if (cancelled || stored == null) {
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

        return () => {
            cancelled = true;
        }
    }, [localforage, triggerReload, status]);

    useEffect(() => {
        if (status == "LOGGED_OUT") return;
        let cancelled = false;

        apiService.getTracks().then(result => {
            if (cancelled) return;
            if (isError(result)) {
                throw new Error(result.error);
            }
            const tracks = new Map(Object.entries(result));
            setTracks(tracks);
            setPlaylists(Array.from(tracks.keys()));
        }).catch((error: Error) => {
            console.error(error);
            OBR.notification.show(`Error retrieving tracks (${error.message})`, "ERROR");
        });

        return () => {
            cancelled = true;
        }
    }, [triggerReload, status]);

    return <TrackContext.Provider value={{tracks, playlists, hasLocalTracks, importTracks, addTrack, removeTrack, updateTrack, reload, purgeLocalTracks}}>
        { children }
    </TrackContext.Provider>;
}
