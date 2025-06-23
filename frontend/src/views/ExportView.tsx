import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography } from "@mui/material";
import { Track, useTracks } from "../providers/TrackProvider";
import { faAdd, faFileExport, faFileImport, faTrash } from "@fortawesome/free-solid-svg-icons";
import { useCallback, useRef, useState } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import OBR from "@owlbear-rodeo/sdk";
import { addTrackModal } from "./AddTrackView";
import { importLocalTracksModal } from "./ImportLocalTracksView";
import { useAuth } from "../providers/AuthProvider";

type ModalType = "DELETE_TRACKS";

export function ExportView() {
    const { tracks, importTracks, hasLocalTracks, purgeLocalTracks } = useTracks();
    const { status } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [openedModal, setModalOpened] = useState<ModalType|null>(null);

    const openModal = (modalName: ModalType) => {
        setModalOpened(modalName);
    };

    const closeModal = () => {
        setModalOpened(null);
    };

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
    
    return <Box>
        <Box sx={{ p: 2, overflow: "auto", height: "calc(100vh - 50px)" }}>
            <Box sx={{ flexDirection: "row", justifyContent: "space-evenly", display: status === "LOGGED_IN" ? "none" : "flex"}}>
                <Button variant="outlined" onClick={exportFile}>
                    <FontAwesomeIcon icon={faFileExport} style={{marginRight: "0.5rem"}} /> Export
                </Button>
                <Button variant="outlined" onClick={() => OBR.modal.open(addTrackModal)}>
                    <FontAwesomeIcon icon={faAdd} style={{marginRight: "0.5rem"}} /> Add Track
                </Button>
                <Button variant="outlined" onClick={() => fileInputRef.current?.click?.()}>
                    <input
                        type="file"
                        accept=".json"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        style={{ display: "none" }}
                    />
                    <FontAwesomeIcon icon={faFileImport} style={{marginRight: "0.5rem"}} /> Import
                </Button>
            </Box>
            <Box sx={{ p: 1 }} />
            <Box className="instructions" style={{display: status === "LOGGED_IN" ? "none" : "block"}}>
                <Typography>
                    To bring your music into Hoot, simply use the import button to upload
                    a JSON file containing your curated track list, following the format below.
                    Once imported, Hoot saves this data into your browser storage.
                </Typography>
                <Box sx={{ p: 1 }} />
                <Box>
                    <Typography fontFamily="monospace">{"["}</Typography>
                    <Box sx={{ pl: 4 }}>
                        <Typography fontFamily="monospace">{"{"}</Typography>
                        <Box sx={{ pl: 4 }}>
                            <Typography fontFamily="monospace">"name": "Track 1",</Typography>
                            <Typography fontFamily="monospace">"source": "https://site.com/track.mp3",</Typography>
                            <Typography fontFamily="monospace">"playlists": ["Calm", "Sad"]</Typography>
                        </Box>
                        <Typography fontFamily="monospace">{"},"}</Typography>
                        <Typography fontFamily="monospace">...</Typography>
                    </Box>
                    <Typography fontFamily="monospace">{"]"}</Typography>
                </Box>
                <Box sx={{ p: 1 }} />
                <Typography>
                    You can export this data using the export button.
                    These features are required since Hoot cannot store music files directly. 
                </Typography>
                <Box sx={{ p: 1 }} />
                <Typography><Box component="span" fontWeight="bold">NOTE:</Box> Browsers might delete this data, so it's important to keep a backup!</Typography>
            </Box>
            <Box sx={{display: status === "LOGGED_OUT" ? "none" : "block"}}>
                <Typography>
                    To bring your music into Hoot, simply use the add track button to
                    start uploading your files. You can check your usage in the settings tab.
                    These tracks will be synced across all your devices.
                </Typography>
                <Box sx={{ p: 1 }} />
                {
                    hasLocalTracks &&
                    <>
                        <Typography>
                            To import your local tracks into your Hoot account, you can use the
                            import tracks button. You can delete them from local storage after 
                            that is done.
                        </Typography>
                        <Typography>
                            <Box fontWeight="bold" component="span">Note:</Box> your local tracks won't 
                            be available while you're logged in.
                        </Typography>
                        <Box sx={{ p: 1 }} />
                    </>
                }
                <Box sx={{ display: "grid", grid: "auto-flow dense / 1fr 1fr 1fr" }}>
                    <Button variant="outlined" sx={{mr: 2}} onClick={() => OBR.modal.open(addTrackModal)}>
                        <FontAwesomeIcon icon={faAdd} style={{ marginRight: "0.5rem" }} />Add Track
                    </Button>
                    {
                        hasLocalTracks && <>
                            <Button variant="outlined" sx={{ mr: 2}} onClick={() => OBR.modal.open(importLocalTracksModal)}>
                                <FontAwesomeIcon icon={faFileImport} style={{ marginRight: "0.5rem" }} /> Import tracks
                            </Button>   
                            <Button variant="outlined" onClick={() => openModal("DELETE_TRACKS")}>
                                <FontAwesomeIcon icon={faTrash} style={{ marginRight: "0.5rem" }} /> Delete tracks
                            </Button>  
                        </>
                    }
                </Box>
            </Box>
        </Box>
        <Dialog
            open={openedModal === "DELETE_TRACKS"}
            onClose={closeModal}
          >
            <DialogTitle>Delete Tracks</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Are you sure you want to delete all your <Box component="span" sx={{fontWeight: "bold"}}>local</Box> tracks?
                    This operation is irreversible, so export your tracks before deleting them to keep a backup.
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => { purgeLocalTracks(); closeModal(); }}>
                    <FontAwesomeIcon icon={faTrash} style={{marginRight: "0.5rem"}} /> Delete
                </Button>  
                <Button onClick={() => closeModal()}>
                    Cancel
                </Button>  
            </DialogActions>
        </Dialog>
    </Box>;
}
