import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useOBRBase, useOBRSelf } from "./hooks";

import { AddTrackView } from "./views/AddTrackView";
import { AudioPlayerProvider } from "./providers/AudioPlayerProvider";
import { AuthProvider } from "./providers/AuthProvider";
import { ControlledPlayerProvider } from "./providers/ControlledPlayerProvider";
import { GMView } from "./views/GMView";
import { ImportLocalTracksModal } from "./views/ImportLocalTracksView";
import { OBRThemeProvider } from "./providers/OBRThemeProvider";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { PlayerView } from "./views/PlayerView";
import { PrivacyPolicyView } from "./views/PrivacyPolicyView";
import { QueryClient } from "@tanstack/react-query";
import { SettingsProvider } from "./providers/SettingsProvider";
import { SignUpView } from "./views/SignUpView";
import { TermsOfServiceView } from "./views/TermsOfServiceView";
import { TrackProvider } from "./providers/TrackProvider";
import { Typography } from "@mui/material";
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

function OBRRoute({ children }: { children: React.ReactNode }): React.ReactNode {
    const { ready } = useOBRBase();

    if (!ready) {
        return null;
    }

    return <OBRThemeProvider>
        { children } 
    </OBRThemeProvider>;
}

function MainApp({ proxy = false }: { proxy?: boolean }) {
    const player = useOBRSelf();

    if (player == null) {
        return <Typography>Could not load Owlbear Extension.</Typography>;
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
        return <ControlledPlayerProvider>
            <PlayerView />
        </ControlledPlayerProvider>;
    }
}

function AddTrackModal() {
    const { ready } = useOBRBase();
    const player = useOBRSelf();

    if (!ready || player == null) {
        return;
    }

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

export default function Hoot() {
    return <BrowserRouter>
        <Routes>
            <Route path="/" element={<OBRRoute><MainApp /></OBRRoute>} />
            <Route path="/add-track" element={<OBRRoute><AddTrackModal /></OBRRoute>} />
            <Route path="/import-local-tracks" element={<OBRRoute><ImportLocalTracksModal /></OBRRoute>} />
            <Route path="/signup" element={<SignUpView />} />
            <Route path="/verify/:verificationCode" element={<VerifyEmailView />} />
            <Route path="/tos" element={<TermsOfServiceView />} />
            <Route path="/privacy" element={<PrivacyPolicyView />} />
        </Routes>
    </BrowserRouter>;
}
