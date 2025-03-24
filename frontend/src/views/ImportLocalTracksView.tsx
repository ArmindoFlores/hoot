import { APP_KEY, STORAGE_KEYS } from "../config";
import { apiService, isError } from "../services/apiService";
import { useEffect, useState } from "react";

import { Line } from "rc-progress";
import { Modal } from "@owlbear-rodeo/sdk/lib/types/Modal";
import OBR from "@owlbear-rodeo/sdk";
import { Track } from "../components/TrackProvider";
import localforage from "localforage";

// import OBR from "@owlbear-rodeo/sdk";
// import { useAuth } from "../components/AuthProvider";

// eslint-disable-next-line react-refresh/only-export-components
export const importLocalTracksModal: Modal = {
    id: `${APP_KEY}/import-local-tracks`,
    url: "/import-local-tracks",
    height: 300,
    width: 500,
}

export function ImportLocalTracksModal() {
    // const { status } = useAuth();
    
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
            currentTrack.playlists,
            currentTrack.source
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
    
    return <div className="generic-view paper">
        <div className="generic-view-inner">
            <h2>Import local tracks</h2>
            <br></br>
            {
                progress < localTracks.length ?
                (
                    error ? 
                    <p>An error has occurred while importing the tracks: <span style={{fontStyle: "italic"}}>{error}</span></p>
                    :
                    <p>Importing local tracks, please do not close this window.</p>
                )
                :
                <p>All tracks have been imported. You may now close this window.</p>
            }
            <br></br>
            <div style={{display: "flex", justifyContent: "space-between", flexDirection: "row"}}>
                <p>{Math.round(progress / localTracks.length * 100)}%</p>
                <Line percent={progress / localTracks.length * 100} strokeWidth={4} trailWidth={4} style={{marginLeft: "1rem", marginRight: "1rem"}} />
                <p>{progress}/{localTracks.length}</p>
            </div>
        </div>
    </div>;
}
