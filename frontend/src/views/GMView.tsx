import { faGear, faImage, faList, faMusic, faUpRightFromSquare, faUpload } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useMemo, useRef, useState } from "react";

import { APP_KEY } from "../config";
import { AudioPlayerView } from "./AudioPlayerView";
import { ExportView } from "./ExportView";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { MessageContent } from "../types/messages";
import OBR from "@owlbear-rodeo/sdk";
import { SceneView } from "./SceneView";
import { SettingsView } from "./Settings";
import { TrackListView } from "./TrackListView";
import { useArrayCompareMemoize } from "../hooks";
import { useAudioPlayer } from "../components/AudioPlayerProvider";
import { useOBRMessaging } from "../react-obr/providers";
import { useSettings } from "../components/SettingsProvider";
import { useTracks } from "../components/TrackProvider";

type Screen = "track-list" | "player" | "export" | "scene" | "settings";

function Navbar({ selectedScreen, setSelectedScreen }: { selectedScreen: Screen, setSelectedScreen: (screen: Screen) => void }) {
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
}

export function GMView() {
    const { sendMessage, registerMessageHandler } = useOBRMessaging();
    const { playing, setIsPlaying, setTrack, setRepeatMode, setShuffle, setVolume } = useAudioPlayer();
    const { addTrack, reload: reloadTracks, tracks, } = useTracks();
    const { reload: reloadSettings } = useSettings();
    const playingPlaylists = useMemo(() => Object.keys(playing), [playing]);
    const memoizedPlayingPlaylists = useArrayCompareMemoize(playingPlaylists);

    const [ selectedScreen, setSelectedScreen ] = useState<Screen>("track-list");
    const [ isPoppedOut, setPoppedOut ] = useState(false);
    const popup = useRef<Window|null>(null);

    const openPopup = () => {
        OBR.action.getHeight().then(height => {
            popup.current = window.open(
                `${document.location.origin}/popup${document.location.search}`,
                `${APP_KEY}/popup`,
                "popup,width=500,height=600"
            );
            setPoppedOut(true);
            OBR.action.setHeight(50);
            OBR.action.close();
            const popupInterval = setInterval(() => {
                if (popup.current?.closed) {
                    clearInterval(popupInterval);
                    popup.current = null;
                    setPoppedOut(false);
                    OBR.action.setHeight(height ?? 500);
                    OBR.action.open();
                    reloadTracks();
                    reloadSettings();
                }
            }, 250);
        });
    }

    useEffect(() => {
        if (isPoppedOut) return;

        return registerMessageHandler(message => {
            const messageContent = message.message as MessageContent;
            if (messageContent.type === "get-playlists") {
                sendMessage({ type: "playlists", payload: Object.keys(playing) }, [message.sender]);
            }
            else if (messageContent.type === "get-track") {
                const playlist = messageContent.payload;
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
            else if (messageContent.type === "add-track") {
                const track = messageContent.payload;
                addTrack(track);
            }
        });
    }, [playing, addTrack, registerMessageHandler, sendMessage, isPoppedOut]);

    useEffect(() => {
        if (isPoppedOut) return;

        return registerMessageHandler(message => {
            // Allow other extensions to talk to hoot
            const messageContent = message.message as MessageContent;
            if (messageContent.type === "play") {
                const payload = messageContent.payload;
                const playlist = payload.playlist;
                const trackId = payload.track;
                const playlistTracks = tracks.get(playlist);
                if (playlistTracks == undefined) {
                    console.error("Couldn't find playlist");
                    return;
                }
                const track = playlistTracks.find(t => t.id === trackId);
                if (track == undefined) {
                    console.error("Couldn't find track");
                    return;
                }
                if (payload.shuffle != undefined) {
                    setShuffle(payload.shuffle, playlist);
                }
                if (payload.repeatMode != undefined) {
                    setRepeatMode(payload.repeatMode, playlist);
                }
                if (payload.volume != undefined || playing[playlist] == undefined) {
                    setVolume(payload.volume ?? 0.75, playlist);
                }
                setTrack(track, playlist);
                setIsPlaying(true, playlist);
            }
        });
    }, [isPoppedOut, registerMessageHandler, setIsPlaying, setTrack, tracks, setShuffle, setRepeatMode, setVolume, playing]);

    useEffect(() => {
        if (isPoppedOut) return;
        sendMessage({ type: "playlists", payload: memoizedPlayingPlaylists });
    }, [memoizedPlayingPlaylists, sendMessage, isPoppedOut]);

    if (isPoppedOut) {
        return <div className="inactive-window">
            <p>
            Hoot is running in another window.
            </p>
        </div>;
    }
    
    return <>
        <Navbar selectedScreen={selectedScreen} setSelectedScreen={setSelectedScreen} />
        {
            document.location.pathname !== "/popup" &&
            <div 
                className="popout clickable"
                onClick={openPopup}
            >
                <FontAwesomeIcon icon={faUpRightFromSquare} />
            </div>
        }
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
    </>
}
