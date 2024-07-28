import { APP_KEY } from "../config";
import { AudioPlayerProvider } from "../components/AudioPlayerProvider";
import { GMView } from "./GMView";
import { OBRMessageProvider } from "../react-obr/providers";
import { PlayerView } from "./PlayerView";
import { SettingsProvider } from "../components/SettingsProvider";
import { TrackProvider } from "../components/TrackProvider";
import { useCallback } from "react";
import { useOBR } from "../react-obr/providers/BaseOBRProvider";

export function Hoot() {
    const { player } = useOBR();

    const MainApp = useCallback(() => {
        if (player == null) {
            return <p>Could not load Owlbear Extension.</p>;
        }
        if (player.role == "GM") {
            return <GMView />;
        }
        else {
            return <PlayerView />;
        }
    }, [player?.role]);

    return <>
        <OBRMessageProvider appKey={APP_KEY}>
            <SettingsProvider>
                <TrackProvider>
                    <AudioPlayerProvider>
                        <MainApp />
                    </AudioPlayerProvider>
                </TrackProvider>
            </SettingsProvider>
        </OBRMessageProvider>
    </>;
}
