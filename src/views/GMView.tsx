import { faGear, faList, faMusic, faUpload } from "@fortawesome/free-solid-svg-icons";
import { useCallback, useState } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { TrackListView } from "./TrackListView";
import { TrackProvider } from "../components/TrackProvider";
import { useOBRMessaging } from "../react-obr/providers";

type Screen = "track-list" | "player" | "export" | "settings";

export function GMView() {
    const { sendMessage } = useOBRMessaging();
    
    const [ selectedScreen, setSelectedScreen ] = useState<Screen>("track-list");

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

    const Body = useCallback(() => {
        if (selectedScreen === "track-list") {
            return <TrackListView />;
        }
        return <></>;
    }, [selectedScreen]);

    return <>
        <Navbar />
        <TrackProvider>
            <div className="body">
                <Body />
            </div>
        </TrackProvider>
    </>;
}
