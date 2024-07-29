import { faGear, faImage, faList, faMusic, faUpload } from "@fortawesome/free-solid-svg-icons";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AudioPlayerView } from "./AudioPlayerView";
import { ExportView } from "./ExportView";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { MessageContent } from "../types/messages";
import { SceneView } from "./SceneView";
import { SettingsView } from "./Settings";
import { TrackListView } from "./TrackListView";
import { useArrayCompareMemoize } from "../hooks";
import { useAudioPlayer } from "../components/AudioPlayerProvider";
import { useOBRMessaging } from "../react-obr/providers";

type Screen = "track-list" | "player" | "export" | "scene" | "settings";

export function GMView() {
    const { sendMessage, registerMessageHandler } = useOBRMessaging();
    const { playing } = useAudioPlayer();
    const playingPlaylists = useMemo(() => Object.keys(playing), [playing]);
    const memoizedPlayingPlaylists = useArrayCompareMemoize(playingPlaylists);

    const [ selectedScreen, setSelectedScreen ] = useState<Screen>("track-list");

    useEffect(() => {
        return registerMessageHandler(message => {
            const messageContent = message.message as MessageContent;
            if (messageContent.type === "get-playlists") {
                sendMessage({ type: "playlists", payload: Object.keys(playing) }, [message.sender]);
            }
            else if (messageContent.type === "get-track") {
                const playlist = messageContent.payload as string;
                const track = playing[playlist];
                if (track !== undefined) {
                    sendMessage(
                        {
                            type: "track", 
                            payload:  {
                                playlist,
                                name: track.track.name,
                                source: track.track.source,
                                time: track.time,
                                volume: track.volume,
                                playing: track.playing
                            }
                        },
                        [message.sender]
                    );
                }
            }
            else if (messageContent.type === "track") {
                // console.log("Sent track update:", messageContent.payload);
            }
            else if (messageContent.type === "playlists") {
                // console.log("Sent playlists update:", messageContent.payload);
            }
            else if (messageContent.type === "fade") {
                // console.log("Sent fade instruction:", messageContent.payload);
            }
            else {
                console.error(`Received invalid message of type '${messageContent.type}':`, messageContent.payload);
            }
        });
    }, [playing]);

    useEffect(() => {
        sendMessage({ type: "playlists", payload: Object.keys(playing) });
    }, [memoizedPlayingPlaylists]);

    const Navbar = useCallback(() => {
        return <div className="navbar">
            <div
                className={`navbar-icon ${selectedScreen === "track-list" ? "navbar-selected" : ""}`}
                title="Track List"
                onClick={() => setSelectedScreen("track-list")}
            >
                <FontAwesomeIcon icon={faList} />
            </div>
            <div
                className={`navbar-icon ${selectedScreen === "player" ? "navbar-selected" : ""}`}
                title="Audio Player"
                onClick={() => setSelectedScreen("player")}
            >
                <FontAwesomeIcon icon={faMusic} />
            </div>
            <div
                className={`navbar-icon ${selectedScreen === "scene" ? "navbar-selected" : ""}`}
                title="Scene Configuration"
                onClick={() => setSelectedScreen("scene")}
            >
                <FontAwesomeIcon icon={faImage} />
            </div>
            <div
                className={`navbar-icon ${selectedScreen === "export" ? "navbar-selected" : ""}`}
                title="Export/Import"
                onClick={() => setSelectedScreen("export")}
            >
                <FontAwesomeIcon icon={faUpload} />
            </div>
            <div
                className={`navbar-icon ${selectedScreen === "settings" ? "navbar-selected" : ""}`}
                title="Global Settings"
                onClick={() => setSelectedScreen("settings")}
            >
                <FontAwesomeIcon icon={faGear} />
            </div>
            </div>;
    }, [selectedScreen]);

    return <>
        <Navbar />
        <div className="body" style={{ display: selectedScreen === "track-list" ? undefined : "none"}}>
            <TrackListView />
        </div>
        <div className="body" style={{ display: selectedScreen === "player" ? undefined : "none"}}>
            <AudioPlayerView />
        </div>
        <div className="body" style={{ display: selectedScreen === "scene" ? undefined : "none"}}>
            <SceneView />
        </div>
        <div className="body" style={{ display: selectedScreen === "export" ? undefined : "none"}}>
            <ExportView />
        </div>
        <div className="body" style={{ display: selectedScreen === "settings" ? undefined : "none"}}>
            <SettingsView />
        </div>
    </>;
}
