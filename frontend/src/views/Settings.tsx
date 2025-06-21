import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Input, Link, Switch, Typography } from "@mui/material";
import { PATREON_CLIENT_ID, PATREON_REDIRECT_URI } from "../config";
import { apiService, isError } from "../services/apiService";
import { faInfoCircle, faUnlink } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Line } from "rc-progress";
import OBR from "@owlbear-rodeo/sdk";
import { User } from "../types/user";
import { byteSize } from "../utils";
import { faPatreon } from "@fortawesome/free-brands-svg-icons";
import { useAuth } from "../components/AuthProvider";
import { useOBRTheme } from "../hooks";
import { useSettings } from "../components/SettingsProvider";

const PATREON_URL = `https://www.patreon.com/oauth2/authorize?response_type=code&client_id=${PATREON_CLIENT_ID}&redirect_uri=${PATREON_REDIRECT_URI}&state=123`;
type ModalType = "PATREON" | "UNLINK_PATREON";

function LoginForm({ onLogin }: { onLogin: (user: User) => void }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        apiService.login(email, password).then(result => {   
            if (isError(result)) {
                throw new Error(result.error);
            }
            OBR.notification.show("Login successful", "SUCCESS");
            onLogin(result);
        }).catch((error: Error) => {
            OBR.notification.show(error.message, "ERROR");
        });
    };

    return <Box component="form" action="#" onSubmit={handleLogin} sx={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Box sx={{ display: "flex", flexDirection: "row", gap: 2, alignItems: "center", justifyContent: "flex-start"}}>
            <Typography fontWeight="bold">Email</Typography>
            <Input
                sx={{textAlign: "left"}}
                name="email"
                value={email}
                type="email"
                onChange={e => setEmail(e.target.value)}
            />
        </Box>
        <Box sx={{ p: 1 }} />
        <Box sx={{ display: "flex", flexDirection: "row", gap: 2, alignItems: "end", justifyContent: "flex-start"}}>
            <Typography fontWeight="bold">Password</Typography>
            <Input
                sx={{textAlign: "left"}}
                name="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
            />
        </Box>
        <Box sx={{ p: 1 }} />
        <Box sx={{display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-evenly"}}>
            <Button disabled={email == "" || password == ""} type="submit" variant="outlined">
                Log In
            </Button>
            <Typography style={{marginLeft: "1rem"}}>
                Or <Link href="/signup" target="_blank" style={{color: "white", fontWeight: "bold"}}>create your account</Link>
            </Typography>
        </Box>
    </Box>;
}

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

    const { status, user, doLogin, doLogout, refresh } = useAuth();

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
                        status === "LOGGED_OUT" && <>
                            <Typography>Login to host your tracks directly in Hoot, and sync across all devices.</Typography>
                            <Box sx={{ p: 1 }} />
                            <LoginForm onLogin={doLogin}></LoginForm>
                        </>
                    }
                    {
                        status === "LOGGED_IN" && user && <>
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
                                    sx={{ml: 0.5}}
                                    className="clickable"
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
