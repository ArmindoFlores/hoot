import "./Hoot.css";

import { BaseOBRProvider, useOBR } from "./react-obr/providers/BaseOBRProvider";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { APP_KEY } from "./config";
import { AddTrackView } from "./views/AddTrackView";
import { AudioPlayerProvider } from "./components/AudioPlayerProvider";
import { AuthProvider } from "./components/AuthProvider";
import { GMView } from "./views/GMView";
import { OBRMessageProvider } from "./react-obr/providers";
import { PlayerView } from "./views/PlayerView";
import { SettingsProvider } from "./components/SettingsProvider";
import { TrackProvider } from "./components/TrackProvider";

function withOBRProvider(element: JSX.Element, proxy: boolean): JSX.Element {
    return <BaseOBRProvider proxy={proxy}>
        <OBRMessageProvider appKey={APP_KEY} proxy={proxy}>
            { element } 
        </OBRMessageProvider>
    </BaseOBRProvider>;
}

function PopupMainApp() {
    return <div className="popup-container">
        <div className="popup-container-inner">
            <MainApp proxy={true} />
        </div>
    </div>;
}

function MainApp({ proxy = false }: { proxy?: boolean }) {
    const { player } = useOBR();

    if (player == null) {
        return <p>Could not load Owlbear Extension.</p>;
    }
    if (player.role == "GM") { 
        return <TrackProvider proxy={proxy}>
            <AuthProvider proxy={proxy}>
                <SettingsProvider proxy={proxy}>
                    <AudioPlayerProvider>
                        <GMView />
                    </AudioPlayerProvider>
                </SettingsProvider>
            </AuthProvider>
        </TrackProvider>;
    }
    else {
        return <PlayerView />;
    }
}

function AddTrackModal() {
    return <TrackProvider proxy={false}>
        <AddTrackView />
    </TrackProvider>;
}

export default function Hoot() {
    return <BrowserRouter>
        <Routes>
            <Route path="/" element={withOBRProvider(<MainApp />, false)} />
            <Route path="/add-track" element={withOBRProvider(<AddTrackModal />, false)} />
            <Route path="/popup" element={withOBRProvider(<PopupMainApp />, true)} />
        </Routes>
    </BrowserRouter>;
}
