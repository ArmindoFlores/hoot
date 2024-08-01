import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { STORAGE_KEYS } from "../config";
import localforage from "localforage";

interface PlayerSettingsContextType {
    playlistVolume: number;
    setPlaylistVolume: (volume: number) => void;
}

const PlayerSettingsContext = createContext<PlayerSettingsContextType>({
    playlistVolume: 1,
    setPlaylistVolume: () => {},
});
export const usePlayerSettings = () => useContext(PlayerSettingsContext);

export function PlayerSettingsProvider({ children, playlist }: { children: React.ReactNode, playlist?: string }) {
    const [ playlistVolume, _setPlaylistVolume ] = useState(1);

    const setPlaylistVolume = useCallback((volume: number) => {
        if (playlist == undefined) return;
        _setPlaylistVolume(volume);
        localforage.setItem(STORAGE_KEYS.PLAYLIST_VOLUME+playlist, volume);
    }, [playlist]);

    useEffect(() => {
        if (playlist == undefined) return;
        localforage.getItem(STORAGE_KEYS.PLAYLIST_VOLUME+playlist).then(stored => {
            if (stored == null) return;
            if (typeof stored !== "number") return;
            _setPlaylistVolume(stored); 
        });
    }, [playlist]);

    return <PlayerSettingsContext.Provider value={{playlistVolume, setPlaylistVolume}}>
        { children }
    </PlayerSettingsContext.Provider>;
}
