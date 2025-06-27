import { APP_KEY, STORAGE_KEYS } from "../config";
import { Box, Typography } from "@mui/material";
import { apiService, isError } from "../services/apiService";
import { useEffect, useState } from "react";

import { Line } from "rc-progress";
import { Modal } from "@owlbear-rodeo/sdk/lib/types/Modal";
import OBR from "@owlbear-rodeo/sdk";
import { Track } from "../types/tracks";
import localforage from "localforage";
import { useOBRTheme } from "../hooks";

// eslint-disable-next-line react-refresh/only-export-components
export const importLocalTracksModal: Modal = {
    id: `${APP_KEY}/import-local-tracks`,
    url: "/import-local-tracks",
    height: 300,
    width: 500,
}

export function ImportLocalTracksModal() {
    const theme = useOBRTheme();
    
    const [localTracks, setLocalTracks] = useState<Track[]>();
    const [ progress, setProgress ] = useState(0);
    const [ error, setError ] = useState<string>();

    useEffect(() => {
        if (localforage == undefined) return;
        localforage.getItem(STORAGE_KEYS.TRACKS).then(stored => {
            if (stored == null) {
                return;
            }
            if ((stored as Track[]).length > 0) {
                setLocalTracks(stored as Track[]);
            }
        })
    }, []);

    useEffect(() => {
        setProgress(0);
    }, [localTracks]);

    useEffect(() => {
        if (localTracks == undefined) {
            return;
        }

        const currentTrack = localTracks[progress];
        if (currentTrack == undefined) {
            return;
        }
        apiService.addTrackFromURL(
            currentTrack.name,
            currentTrack.playlists ?? [],
            currentTrack.source!
        ).then(result => {
            if (isError(result)) {
                throw new Error(result.error);
            }
            setProgress(old => old + 1);
        }).catch((error: Error) => {
            if (error.message.startsWith("Duplicate")) {
                setProgress(old => old + 1);
                return;
            }
            OBR.notification.show(`Error uploading track (${error.message})`, "ERROR");
            setError(error.message);
        });
    }, [localTracks, progress]);

    if (localTracks == undefined) {
        return <></>;
    }
    
    return <Box sx={{ p: 2 }}>
        <Typography variant="h5">Import local tracks</Typography>
        <Box sx={{ p: 1 }} />
        {
            progress < localTracks.length ?
            (
                error ? 
                <Typography>An error has occurred while importing the tracks: <Box component="span" style={{fontStyle: "italic"}}>{error}</Box></Typography>
                :
                <Typography>Importing local tracks, please do not close this window.</Typography>
            )
            :
            <Typography>All tracks have been imported. You may now close this window.</Typography>
        }
        <Box sx={{ p: 1 }} />
        <Box style={{display: "flex", justifyContent: "space-between", flexDirection: "row"}}>
            <Typography>{Math.round(progress / localTracks.length * 100)}%</Typography>
            <Line strokeColor={theme?.primary.dark} percent={progress / localTracks.length * 100} strokeWidth={4} trailWidth={4} style={{marginLeft: "1rem", marginRight: "1rem"}} />
            <Typography>{progress}/{localTracks.length}</Typography>
        </Box>
    </Box>;
}
