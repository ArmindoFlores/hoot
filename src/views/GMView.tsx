import { faGear, faList, faMusic, faUpload } from "@fortawesome/free-solid-svg-icons";
import { useCallback, useEffect, useState } from "react";

import { AudioPlayerView } from "./AudioPlayerView";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { MessageContent } from "../types/messages";
import { TrackListView } from "./TrackListView";
import { useAudioPlayer } from "../components/AudioPlayerProvider";
import { useOBRMessaging } from "../react-obr/providers";

type Screen = "track-list" | "player" | "export" | "settings";

export function GMView() {
    const { sendMessage, registerMessageHandler } = useOBRMessaging();
    const { playing } = useAudioPlayer();

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
                console.log("Sent track update:", messageContent.payload);
            }
            else if (messageContent.type === "playlists") {
                console.log("Sent playlists update:", messageContent.payload);
            }
            else {
                console.error(`Received invalid message of type '${messageContent.type}':`, messageContent.payload);
            }
        });
    }, [playing]);

    const Navbar = useCallback(() => {
        return <div className="navbar">
            <div
                className={`navbar-icon ${selectedScreen === "track-list" ? "navbar-selected" : ""}`}
                onClick={() => setSelectedScreen("track-list")}
            >
                <FontAwesomeIcon icon={faList} />
            </div>
            <div
                className={`navbar-icon ${selectedScreen === "player" ? "navbar-selected" : ""}`}
                onClick={() => setSelectedScreen("player")}
            >
                <FontAwesomeIcon icon={faMusic} />
            </div>
            <div
                className={`navbar-icon ${selectedScreen === "export" ? "navbar-selected" : ""}`}
                onClick={() => setSelectedScreen("export")}
            >
                <FontAwesomeIcon icon={faUpload} />
            </div>
            <div
                className={`navbar-icon ${selectedScreen === "settings" ? "navbar-selected" : ""}`}
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
    </>;
}
