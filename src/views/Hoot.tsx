import { BaseOBRProvider, useOBR } from "../react-obr/providers/BaseOBRProvider";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { APP_KEY } from "../config";
import { AddTrackView } from "./AddTrackView";
import { AudioPlayerProvider } from "../components/AudioPlayerProvider";
import { GMView } from "./GMView";
import { OBRMessageProvider } from "../react-obr/providers";
import { PlayerView } from "./PlayerView";
import { SettingsProvider } from "../components/SettingsProvider";
import { TrackProvider } from "../components/TrackProvider";

function MainApp() {
    const { player } = useOBR();

    if (player == null) {
        return <p>Could not load Owlbear Extension.</p>;
    }
    if (player.role == "GM") {
        return <TrackProvider>
                <SettingsProvider>
                    <AudioPlayerProvider>
                        <GMView />
                    </AudioPlayerProvider>
                </SettingsProvider>
            </TrackProvider>;
    }
    else {
        return <PlayerView />
    }
}

function AddTrackModal() {
    return <TrackProvider>
        <AddTrackView />
    </TrackProvider>;
}

export function Hoot() {
    return <>
        <BaseOBRProvider>
            <OBRMessageProvider appKey={APP_KEY}>
                <BrowserRouter>
                    <Routes>
                        <Route path="/" element={<MainApp />} />
                        <Route path="/add-track" element={<AddTrackModal />} />
                    </Routes>
                </BrowserRouter>
            </OBRMessageProvider>
        </BaseOBRProvider>
    </>;
}
