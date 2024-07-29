import React, { createContext, useContext, useEffect, useState } from "react";

import { STORAGE_KEYS } from "../config";
import localforage from "localforage";

interface SettingsContextType {
    fadeTime: number;
    stopOtherTracks: boolean;
    setStopOtherTracks: (stop: boolean) => void;
    setFadeTime: (fadeTime: number) => void;
};

const SettingsContext = createContext<SettingsContextType>({
    fadeTime: 4500, 
    stopOtherTracks: false,
    setFadeTime: () => {},
    setStopOtherTracks: () => {}
});
export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [ fadeTime, _setFadeTime ] = useState(4500);
    const [ stopOtherTracks, _setStopOtherTracks ] = useState(false);

    const setFadeTime = (time: number) => {
        _setFadeTime(time);
        localforage.setItem(STORAGE_KEYS.FADE_DURATION, time);
    }

    const setStopOtherTracks = (stop: boolean) => {
        _setStopOtherTracks(stop);
        localforage.setItem(STORAGE_KEYS.STOP_OTHER_TRACKS, stop);
    }

    useEffect(() => {
        localforage.getItem(STORAGE_KEYS.FADE_DURATION).then(stored => {
            if (stored == null) return;
            if (typeof stored !== "number") return;
            _setFadeTime(stored); 
        });
        localforage.getItem(STORAGE_KEYS.STOP_OTHER_TRACKS).then(stored => {
            if (stored == null) return;
            if (typeof stored !== "boolean") return;
            _setStopOtherTracks(stored);
        });
    }, []);

    return <SettingsContext.Provider value={{fadeTime, stopOtherTracks, setFadeTime, setStopOtherTracks}}>
        { children }
    </SettingsContext.Provider>;
}
