import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { APP_KEY, STORAGE_KEYS } from "../config";
import baselocalforage from "localforage";

interface SettingsContextType {
    fadeTime: number;
    stopOtherTracks: boolean;
    enableAutoplay: boolean;
    setEnableAutoplay: (stop: boolean) => void;
    setStopOtherTracks: (stop: boolean) => void;
    setFadeTime: (fadeTime: number) => void;
    reload: () => void;
}

const SettingsContext = createContext<SettingsContextType>({
    fadeTime: 4500, 
    stopOtherTracks: false,
    enableAutoplay: true,
    setFadeTime: () => {},
    setStopOtherTracks: () => {},
    setEnableAutoplay: () => {},
    reload: () => {},
});
// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children, proxy }: { children: React.ReactNode, proxy: boolean }) {
    const [ fadeTime, _setFadeTime ] = useState(4500);
    const [ stopOtherTracks, _setStopOtherTracks ] = useState(false);
    const [ enableAutoplay, _setEnableAutoplay ] = useState(true);
    const [ triggerReload, setTriggerReload ] = useState(0);

    const flocalforage = useCallback(() => {
        if (proxy) {
            return window.opener[APP_KEY]?.localforage as (typeof baselocalforage) | undefined;
        }
        return window[APP_KEY]?.localforage;
    }, [proxy]);
    const localforage = flocalforage();

    const setFadeTime = useCallback((time: number) => {
        if (localforage == undefined) return;
        _setFadeTime(time);
        localforage.setItem(STORAGE_KEYS.FADE_DURATION, time);
    }, [localforage]);

    const reload = useCallback(() => {
        setTriggerReload(previous => previous + 1);
    }, []);

    const setStopOtherTracks = useCallback((stop: boolean) => {
        if (localforage == undefined) return;
        _setStopOtherTracks(stop);
        localforage.setItem(STORAGE_KEYS.STOP_OTHER_TRACKS, stop);
    }, [localforage]);

    const setEnableAutoplay = useCallback((enable: boolean) => {
        if (localforage == undefined) return;
        _setEnableAutoplay(enable);
        localforage.setItem(STORAGE_KEYS.ENABLE_AUTOPLAY, enable);
    }, [localforage]);

    useEffect(() => {
        if (localforage == undefined) return;
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
    }, [localforage, triggerReload]);

    if (!proxy) {
        // This is the main extension window, we define a global localforage object
        if (window[APP_KEY] === undefined) {
            window[APP_KEY] = {};
        }
        window[APP_KEY].localforage = baselocalforage;
    }

    return <SettingsContext.Provider
        value={{
            fadeTime, 
            stopOtherTracks, 
            enableAutoplay,
            setFadeTime, 
            setStopOtherTracks,
            setEnableAutoplay, 
            reload
        }}
    >
        { children }
    </SettingsContext.Provider>;
}
