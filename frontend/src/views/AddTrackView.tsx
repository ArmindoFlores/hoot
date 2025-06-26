import { Box, Button, Input, Typography } from "@mui/material";
import { useCallback, useRef, useState } from "react";

import { APP_KEY } from "../config";
import { Modal } from "@owlbear-rodeo/sdk/lib/types/Modal";
import OBR from "@owlbear-rodeo/sdk";
import { useAuth } from "../providers/AuthProvider";
import { useOBRBroadcast } from "../hooks/obr";

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
    const { sendMessage } = useOBRBroadcast();
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
        sendMessage(
            INTERNAL_BROADCAST_CHANNEL,
            {
                type: "add-track",
                payload: {
                    name: track,
                    playlists: playlistArray,
                    source,
                    file: fileInputRef.current?.files?.[0]
                }
            },
            undefined,
            "LOCAL"
        );
        closeAddTrackModal();
    }, [track, playlists, source, sendMessage, status]);
    
    return <Box sx={{ p: 2 }}>
        <Typography variant="h5">Add new track</Typography>
        <Box sx={{ p: 1 }} />
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "end", gap: 1, justifyContent: "space-between" }}>
            <Typography>Track name</Typography>
            <Input
                style={{width: "14rem"}}
                placeholder="My Track"
                value={track}
                onChange={event => setTrack(event.target.value)}
            />
        </Box>
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "end", gap: 1, justifyContent: "space-between" }}>
            <Typography>Playlist names</Typography>
            <Input
                style={{width: "14rem"}}
                placeholder="Ambient, Battle"
                value={playlists}
                onChange={event => setPlaylists(event.target.value)}
            />
        </Box>
        {
            status === "LOGGED_OUT" && <Box sx={{ display: "flex", flexDirection: "row", alignItems: "end", gap: 1, justifyContent: "space-between" }}>
                <Typography>Source</Typography>
                <Input
                    style={{width: "14rem"}}
                    placeholder="https://website.com/file.mp3"
                    value={source}
                    onChange={event => setSource(event.target.value)}
                />
            </Box>
        }
        {
            status === "LOGGED_IN" && <Box sx={{ display: "flex", flexDirection: "row", alignItems: "end", gap: 1, justifyContent: "space-between" }}>
                <Typography>Source</Typography>
                <Input
                    style={{width: "14rem"}}
                    ref={fileInputRef}
                    inputProps={{ accept: "audio/*" }}
                    type="file"
                />
            </Box>
        }
        <Box sx={{ p: 1 }} />
        <Box style={{ width: "100%", display: "flex", justifyContent: "space-evenly"}}>
            <Button variant="outlined" onClick={handleAdd}>
               Add
            </Button>
            <Button variant="outlined" onClick={closeAddTrackModal}>
                Cancel
            </Button>
        </Box>
    </Box>;
}
