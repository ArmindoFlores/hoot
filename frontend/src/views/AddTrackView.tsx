import { useCallback, useRef, useState } from "react";

import { APP_KEY } from "../config";
import { Modal } from "@owlbear-rodeo/sdk/lib/types/Modal";
import OBR from "@owlbear-rodeo/sdk";
import { useAuth } from "../components/AuthProvider";
import { useOBRMessaging } from "../react-obr/providers";

// eslint-disable-next-line react-refresh/only-export-components
export const addTrackModal: Modal = {
    id: `${APP_KEY}/add-track`,
    url: "/add-track",
    height: 275,
    width: 400,
}

function closeAddTrackModal() {
    return OBR.modal.close(addTrackModal.id);
}

export function AddTrackView() {
    const { sendMessage } = useOBRMessaging();
    const { status } = useAuth();
    
    const [ track, setTrack ] = useState("");
    const [ playlists, setPlaylists ] = useState("");
    const [ source, setSource ] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAdd = useCallback(() => {
        const playlistArray = playlists.split(",");

        if (track.length > 0 && track.startsWith(" ")) {
            OBR.notification.show("Please choose a name for this track", "ERROR");
            return;
        }
        if (playlists.length == 0) {
            OBR.notification.show("Please choose at least one playlist", "ERROR");
            return;
        }
        if (playlistArray.filter(p => p.length == 0 || p.startsWith(" ")).length != 0) {
            OBR.notification.show("Invalid playlist name(s)", "ERROR");
            return;
        }
        if (status == "LOGGED_OUT" && source == "") {
            OBR.notification.show("Please enter a source for this track", "ERROR");
            return;
        }
        if (status == "LOGGED_IN" && fileInputRef.current?.value == undefined) {
            OBR.notification.show("Please upload a file for this track", "ERROR");
            return;
        }
        sendMessage({
            type: "add-track",
            payload: {
                name: track,
                playlists: playlistArray,
                source,
                file: fileInputRef.current?.files?.[0]
            }
        }, undefined, "LOCAL");
        closeAddTrackModal();
    }, [track, playlists, source, sendMessage, status]);
    
    return <div className="generic-view paper">
        <div className="generic-view-inner">
            <h2>Add new track</h2>
            <br></br>
            <div className="addtrack-row">
                <label>Track name</label>
                <input
                    style={{width: "14rem"}}
                    placeholder="My Track"
                    value={track}
                    onChange={event => setTrack(event.target.value)}
                />
            </div>
            <div className="addtrack-row">
                <label>Playlist names</label>
                <input
                    style={{width: "14rem"}}
                    placeholder="Ambient, Battle"
                    value={playlists}
                    onChange={event => setPlaylists(event.target.value)}
                />
            </div>
            {
                status === "LOGGED_OUT" && <div className="addtrack-row">
                    <label>Source</label>
                    <input
                        style={{width: "14rem"}}
                        placeholder="https://website.com/file.mp3"
                        value={source}
                        onChange={event => setSource(event.target.value)}
                    />
                </div>
            }
            {
                status === "LOGGED_IN" && <div className="addtrack-row">
                    <label>Source</label>
                    <input
                        ref={fileInputRef}
                        accept="audio/*"
                        style={{width: "14rem"}}
                        type="file"
                    />
                </div>
            }
            <br></br>
            <div style={{ width: "100%", display: "flex", justifyContent: "space-evenly"}}>
                <button onClick={handleAdd}>
                    <p className="bold text-medium">Add</p>
                </button>
                <button onClick={closeAddTrackModal}>
                    <p className="bold text-medium">Cancel</p>
                </button>
            </div>
        </div>
    </div>;
}
