import React, { createContext, useContext, useEffect, useState } from "react";

import { STORAGE_KEYS } from "../config";
import localforage from "localforage";

interface SettingsContextType {
    fadeTime: number;
    setFadeTime: (fadeTime: number) => void;
};

const SettingsContext = createContext<SettingsContextType>({ fadeTime: 4500, setFadeTime: () => {} });
export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
    const [ fadeTime, setFadeTime ] = useState(4500);

    useEffect(() => {
        localforage.getItem(STORAGE_KEYS.FADE_DURATION).then(stored => {
            if (stored == null) return;
            if (typeof stored !== "number") return;
            setFadeTime(stored); 
        });
    }, []);

    return <SettingsContext.Provider value={{fadeTime, setFadeTime}}>
        { children }
    </SettingsContext.Provider>;
}
