import "./Hoot.css";

import { BaseOBRProvider, useOBR } from "./react-obr/providers/BaseOBRProvider";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { APP_KEY } from "./config";
import { AddTrackView } from "./views/AddTrackView";
import { AudioPlayerProvider } from "./components/AudioPlayerProvider";
import { AuthProvider } from "./components/AuthProvider";
import { GMView } from "./views/GMView";
import { ImportLocalTracksModal } from "./views/ImportLocalTracksView";
import Modal from "react-modal";
import { OBRMessageProvider } from "./react-obr/providers";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { PlayerView } from "./views/PlayerView";
import { QueryClient } from "@tanstack/react-query";
import { SettingsProvider } from "./components/SettingsProvider";
import { SignUpView } from "./views/SignUpView";
import { TrackProvider } from "./components/TrackProvider";
import { VerifyEmailView } from "./views/VerifyEmailView";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            gcTime: 1000 * 60 * 60 * 24,
        },
    },
});

const persister = createSyncStoragePersister({
    storage: window.localStorage,
});

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
        return <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister }}
        >
            <AuthProvider proxy={proxy}>
                <TrackProvider proxy={proxy}>
                    <SettingsProvider proxy={proxy}>
                        <AudioPlayerProvider>
                            <GMView />
                        </AudioPlayerProvider>
                    </SettingsProvider>
                </TrackProvider>
            </AuthProvider>
        </PersistQueryClientProvider>;
    }
    else {
        return <PlayerView />;
    }
}

function AddTrackModal() {
    return <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister }}
    >
        <AuthProvider proxy={false}>
            <TrackProvider proxy={false}>
                <AddTrackView />
            </TrackProvider>
        </AuthProvider>
    </PersistQueryClientProvider>;
}

Modal.setAppElement("#root");

export default function Hoot() {
    return <BrowserRouter>
        <Routes>
            <Route path="/" element={withOBRProvider(<MainApp />, false)} />
            <Route path="/add-track" element={withOBRProvider(<AddTrackModal />, false)} />
            <Route path="/import-local-tracks" element={withOBRProvider(<ImportLocalTracksModal />, false)} />
            <Route path="/popup" element={withOBRProvider(<PopupMainApp />, true)} />
            <Route path="/signup" element={<SignUpView />} />
            <Route path="/verify/:verificationCode" element={<VerifyEmailView />} />
        </Routes>
    </BrowserRouter>;
}
