import { useCallback, useState } from "react";

import { APP_KEY } from "../config";
import { Modal } from "@owlbear-rodeo/sdk/lib/types/Modal";
import OBR from "@owlbear-rodeo/sdk";
import { useOBRMessaging } from "../react-obr/providers";

export const addTrackModal: Modal = {
    id: `${APP_KEY}/add-track`,
    url: "/add-track",
    height: 250,
    width: 400,
}

function closeAddTrackModal() {
    return OBR.modal.close(addTrackModal.id);
}

export function AddTrackView() {
    const { sendMessage } = useOBRMessaging();
    
    const [ track, setTrack ] = useState("");
    const [ playlists, setPlaylists ] = useState("");
    const [ source, setSource ] = useState("");

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
        if (source == "") {
            OBR.notification.show("Please enter a source for this track", "ERROR");
            return;
        }
        sendMessage({
            type: "add-track",
            payload: {
                name: track,
                playlists: playlistArray,
                source,
            }
        }, undefined, "LOCAL");
        closeAddTrackModal();
    }, [track, playlists, source]);
    
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
            <div className="addtrack-row">
                <label>Source</label>
                <input
                    style={{width: "14rem"}}
                    placeholder="https://website.com/file.mp3"
                    value={source}
                    onChange={event => setSource(event.target.value)}
                />
            </div>
            <br></br>
            <div style={{ width: "100%", display: "flex", justifyContent: "space-evenly"}}>
                <div className="button clickable unselectable" onClick={handleAdd}>
                    <p className="bold text-medium">Add</p>
                </div>
                <div className="button clickable unselectable" onClick={closeAddTrackModal}>
                    <p className="bold text-medium">Cancel</p>
                </div>
            </div>
        </div>
    </div>;
}
