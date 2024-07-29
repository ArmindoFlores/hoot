import { useEffect, useState } from "react";

import { useSettings } from "../components/SettingsProvider";

export function SettingsView() {
    const { 
        fadeTime,
        stopOtherTracks,
        setFadeTime,
        setStopOtherTracks,
    } = useSettings();

    const [ fadeInputValue, setFadeInputValue ] = useState("");
    const [ invalidFadeValue, setInvalidFadeValue ] = useState(false);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = event.target.value;
        if (/^\d*$/.test(newValue)) {
            setFadeInputValue(newValue);
            const int = parseInt(newValue);
            if (isNaN(int) || int <= 0) {
                setInvalidFadeValue(true);
            }
            else {
                setInvalidFadeValue(false);
                setFadeTime(int);
            }
        }
    }

    useEffect(() => {
        setFadeInputValue(fadeTime.toString());
    }, [fadeTime]);
    
    return <div className="generic-view">
        <div className="generic-view-inner">
            <div className="setting-row">
                <label htmlFor="fade-time" className="setting-label">Fade in/out time</label>
                <div className="setting-value">
                    <input id="fade-time" className={invalidFadeValue ? "invalid-value" : undefined} value={fadeInputValue} onChange={handleChange} /> ms
                </div>
            </div>
            <div className="setting-row">
                <label htmlFor="stop-old-tracks" className="setting-label">Stop old tracks when autoplaying</label>
                <div className="setting-value">
                    <input id="stop-old-tracks" checked={stopOtherTracks} onChange={event => setStopOtherTracks(event.target.checked)} type="checkbox" />
                </div>
            </div>
        </div>
    </div>;
}
