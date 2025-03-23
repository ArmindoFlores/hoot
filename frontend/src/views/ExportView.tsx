import { Track, useTracks } from "../components/TrackProvider";
import { faAdd, faFileExport, faFileImport } from "@fortawesome/free-solid-svg-icons";
import { useCallback, useRef } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import OBR from "@owlbear-rodeo/sdk";
import { addTrackModal } from "./AddTrackView";
import { importLocalTracksModal } from "./ImportLocalTracksView";
import { useAuth } from "../components/AuthProvider";

export function ExportView() {
    const { tracks, importTracks, hasLocalTracks } = useTracks();
    const { status } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const exportFile = useCallback(() => {
        const trackList = Array.from(new Set(Array.from(tracks.values()).flat()));

        const jsonStr = JSON.stringify(trackList, null, 4);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "tracks.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [tracks]);

    const importFile = useCallback((file: File) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event: ProgressEvent<FileReader>) => {
                if (event.target?.result) {
                    try {
                        const json = JSON.parse(event.target.result as string);
                        resolve(json);
                    } catch (error) {
                        reject(new Error("Invalid JSON file"));
                    }
                } else {
                    reject(new Error("File could not be read"));
                }
            };
            reader.onerror = () => {
                reject(new Error("File could not be read"));
            };
            reader.readAsText(file);
        });
    }, []);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                const fileContents = await importFile(file);
                importTracks(fileContents as Track[]);
            } catch (e) {
                console.error(e);
                OBR.notification.show(`Error importing file (${(e as Error).message})`, "ERROR");
            }
        }
    };
    
    return <div className="generic-view">
        <div className="generic-view-inner">
            <div className="export-button-container" style={{display: status === "LOGGED_IN" ? "none" : "flex"}}>
                <button onClick={exportFile}>
                    <p className="bold text-medium"><FontAwesomeIcon icon={faFileExport} /> Export</p>
                </button>
                <button onClick={() => OBR.modal.open(addTrackModal)}>
                    <p className="bold text-medium"><FontAwesomeIcon icon={faAdd} /> Add Track</p>
                </button>
                <button onClick={() => fileInputRef.current?.click?.()}>
                    <input
                        type="file"
                        accept=".json"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        style={{ display: "none" }}
                    />
                    <p className="bold text-medium"><FontAwesomeIcon icon={faFileImport} /> Import</p>
                </button>
            </div>
            <br></br>
            <div className="instructions" style={{display: status === "LOGGED_IN" ? "none" : "block"}}>
                <p>
                    To bring your music into Hoot, simply use the import button to upload
                    a JSON file containing your curated track list, following the format below.
                    Once imported, Hoot saves this data into your browser storage.
                </p>
                <br></br>
                <div className="code">
                    <p>{"["}</p>
                    <div className="indent">
                        <p>{"{"}</p>
                        <div className="indent">
                            <p>"name": "Track 1",</p>
                            <p>"source": "https://site.com/track.mp3",</p>
                            <p>"playlists": ["Calm", "Sad"]</p>
                        </div>
                        <p>{"},"}</p>
                        <p>...</p>
                    </div>
                    <p>{"]"}</p>
                </div>
                <br></br>
                <p>
                    You can export this data using the export button.
                    These features are required since Hoot cannot store music files directly. 
                </p>
                <br></br>
                <p><span className="bold">NOTE:</span> Browsers might delete this data, so it's important to keep a backup!</p>
            </div>
            <div className="instructions" style={{display: status === "LOGGED_OUT" ? "none" : "block"}}>
                <p>
                    To bring your music into Hoot, simply use the add track button to
                    start uploading your files. You can check your usage in the settings tab.
                    These tracks will be synced across all your devices.
                </p>
                <br></br>
                {
                    hasLocalTracks &&
                    <>
                        <p>
                            To import your local tracks into your Hoot account, you can use the
                            import local tracks button.
                        </p>
                        <p>
                            <span style={{fontWeight: "bold"}}>Note:</span> your local tracks won't 
                            be available while you're logged in.
                        </p>
                    </>
                }
                <div className="export-button-container">
                    <button onClick={() => OBR.modal.open(addTrackModal)}>
                        <p className="bold text-medium"><FontAwesomeIcon icon={faAdd} /> Add Track</p>
                    </button>
                    {
                        hasLocalTracks && 
                        <button onClick={() => OBR.modal.open(importLocalTracksModal)}>
                            <p className="bold text-medium"><FontAwesomeIcon icon={faFileImport} /> Import local tracks</p>
                        </button>   
                    }
                </div>
            </div>
        </div>
    </div>;
}
