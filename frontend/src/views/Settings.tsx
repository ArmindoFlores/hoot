import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Input, Link, Switch, Typography } from "@mui/material";
import { PATREON_CLIENT_ID, PATREON_REDIRECT_URI } from "../config";
import { apiService, isError } from "../services/apiService";
import { faInfoCircle, faUnlink } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Line } from "rc-progress";
import OBR from "@owlbear-rodeo/sdk";
import { byteSize } from "../utils";
import { faPatreon } from "@fortawesome/free-brands-svg-icons";
import { useAuth } from "../providers/AuthProvider";
import { useOBRTheme } from "../hooks";
import { useSettings } from "../providers/SettingsProvider";

const PATREON_URL = `https://www.patreon.com/oauth2/authorize?response_type=code&client_id=${PATREON_CLIENT_ID}&redirect_uri=${PATREON_REDIRECT_URI}&state=123`;
type ModalType = "PATREON" | "UNLINK_PATREON";

export function SettingsView() {
    const { 
        fadeTime,
        stopOtherTracks,
        enableAutoplay,
        setFadeTime,
        setStopOtherTracks,
        setEnableAutoplay,
    } = useSettings();
    const theme = useOBRTheme();

    const [ fadeInputValue, setFadeInputValue ] = useState("");
    const [ openedModal, setModalOpened ] = useState<ModalType|null>(null);

    const { user, doLogout, refresh } = useAuth();

    const closeModal = () => {
        setModalOpened(null);
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = event.target.value;
        if (/^\d*$/.test(newValue)) {
            setFadeInputValue(newValue);
            const int = parseInt(newValue);
            if (!isNaN(int) && int > 0) {
                setFadeTime(int);
            }
        }
    }

    const handleLogout = () => {
        apiService.logout().then(result => {
            if (isError(result)) {
                throw new Error(result.error);
            }
            doLogout();
        }).catch((error: Error) => {
            OBR.notification.show(`Error logging out (${error.message})`, "ERROR");
        })
    }

    const unlinkFromPatreon = () => {
        apiService.unlinkPatreon().then(result => {
            if (isError(result)) {
                throw new Error(result.error);
            }
            OBR.notification.show("Successfully unlinked Patreon", "SUCCESS");
            refresh();
        }).catch((error: Error) => {
            OBR.notification.show(`Error unlinking patreon (${error.message})`, "ERROR");
        });
    }

    useEffect(() => {
        setFadeInputValue(fadeTime.toString());
    }, [fadeTime]);
    
    return <Box>
        <Box sx={{ p: 2 }}>
            <Box sx={{ p: 0.5, display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <label htmlFor="enable-autoplay" className="setting-label">Enable autoplay</label>
                <Switch checked={enableAutoplay} onChange={event => setEnableAutoplay(event.target.checked)} />
            </Box>
            <Box sx={{ p: 0.5, display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <label htmlFor="stop-old-tracks" className="setting-label">Stop old tracks when autoplaying</label>
                <Switch checked={stopOtherTracks} onChange={event => setStopOtherTracks(event.target.checked)} />
            </Box>
            <Box sx={{ p: 0.5, display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <label htmlFor="fade-time" className="setting-label">Fade in/out time</label>
                <Input
                    value={fadeInputValue} 
                    onChange={handleChange}
                    endAdornment="ms"
                />
            </Box>
            <Box sx={{ p: 1 }} />
            <Box>
                <hr></hr>
                <Box>
                    <Typography variant="h5">Profile</Typography>
                    {
                        user && <>
                            <Box sx={{display: "flex", flexDirection: "row"}}>
                                <Typography fontWeight="bold">Username:</Typography>
                                <Typography sx={{ml: 0.5}}>{ user.username }</Typography>
                            </Box>
                            <Box sx={{display: "flex", flexDirection: "row"}}>
                                <Typography fontWeight="bold">Email:</Typography>
                                <Typography sx={{ml: 0.5}}>{ user.email }</Typography>
                            </Box>
                            <Box sx={{display: "flex", flexDirection: "row"}}>
                                <Typography fontWeight="bold">Subscription:</Typography>
                                <Typography sx={{ml: 0.5}}>{ user.patreon_member ? "Patreon Member" : "Free" }</Typography>
                                <Typography
                                    sx={{ml: 0.5, cursor: "pointer"}}
                                    title="Become a Patreon member to have access to 10GB of storage!"
                                    onClick={() => setModalOpened("PATREON")}
                                >
                                    <FontAwesomeIcon icon={faInfoCircle} />
                                </Typography>
                            </Box>
                            <Box sx={{ p: 1 }} />
                            <Box style={{display: "flex", flexDirection: "row"}}>
                                <Typography fontWeight="bold">Usage:</Typography>
                                <Typography sx={{ml: 0.5}}>{ `${byteSize(user.used_storage)} / ${byteSize(user.total_storage)}` }</Typography>
                            </Box>
                            <Box title={`Usage: ${byteSize(user.used_storage)} / ${byteSize(user.total_storage)}`}>
                                <Line
                                    strokeColor={theme?.primary.dark}
                                    percent={user.used_storage / user.total_storage * 100}
                                    strokeWidth={4}
                                    trailWidth={4}
                                />
                            </Box>
                            <Box style={{paddingTop: "2rem", display: "flex", justifyContent: "space-evenly"}}>
                                <Button variant="outlined" onClick={handleLogout}>
                                    Log out
                                </Button>
                                {
                                    user.patreon_link &&
                                    <Button variant="outlined" onClick={() => setModalOpened("UNLINK_PATREON")}>
                                        <FontAwesomeIcon icon={faPatreon} style={{ marginRight: "0.5rem" }} /> Unlink Patreon
                                    </Button>
                                }
                                {
                                    !user.patreon_link &&
                                    <a href={PATREON_URL} target="_blank">
                                        <Button variant="outlined">
                                            <FontAwesomeIcon icon={faPatreon} style={{ marginRight: "0.5rem" }} /> Link to Patreon
                                        </Button>
                                    </a>
                                }
                            </Box>
                        </>
                    }
                </Box>
            </Box>
        </Box>
        <Dialog
            open={openedModal === "PATREON"}
            onClose={closeModal}
        >
            <DialogTitle>Patreon Membership</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    If 2GB of storage aren't enough for you, or you just want to support my work
                    on Hoot and other extensions, you can <Link href="https://www.patreon.com/Armindoflores" target="_blank">
                    become a Patreon member</Link>.
                </DialogContentText>
                <DialogContentText>
                    Patreon members have access to 10GB of storage. For more information, please read
                    the <Link href="/tos" target="_blank">terms of service</Link>.
                </DialogContentText>
            </DialogContent>
        </Dialog>
        <Dialog
            open={openedModal === "UNLINK_PATREON"}
            onClose={closeModal}
        >
            <DialogTitle>Unlink Patreon</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    Are you sure you want to unlink Patreon from your Hoot account?
                    You will lose all your benefits, even if you're still a member!
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => { unlinkFromPatreon(); closeModal(); }}>
                    <FontAwesomeIcon icon={faUnlink} style={{marginRight: "0.5rem"}} /> Unlink
                </Button>  
                <Button onClick={() => closeModal()}>
                    Cancel
                </Button>  
            </DialogActions>
        </Dialog>
    </Box>;
}
