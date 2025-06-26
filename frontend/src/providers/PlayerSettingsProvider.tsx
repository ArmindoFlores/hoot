/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { APP_KEY } from "../config";
import OBR from "@owlbear-rodeo/sdk";
import { useOBRSelf } from "../hooks";

const KEY = `${APP_KEY}/playlistVolumes`;

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
    const player = useOBRSelf();

    const [ playlistVolume, _setPlaylistVolume ] = useState(1);

    const setPlaylistVolume = useCallback((volume: number) => {
        if (playlist == undefined) return;

        const playlistVolumes = player?.metadata?.[KEY] as (Record<string, number>|undefined) ?? {};
        playlistVolumes[playlist] = volume;

        OBR.player.setMetadata({ [KEY]: playlistVolumes });
    }, [playlist, player]);

    useEffect(() => {
        if (playlist == undefined) return;
        const playlistVolumes = player?.metadata?.[KEY] as (Record<string, number>|undefined) ?? {};
        const possibleVolume = playlistVolumes[playlist];
        if (possibleVolume !== undefined) {
            _setPlaylistVolume(possibleVolume);
        }
    }, [playlist, player]);

    return <PlayerSettingsContext.Provider value={{playlistVolume, setPlaylistVolume}}>
        { children }
    </PlayerSettingsContext.Provider>;
}
