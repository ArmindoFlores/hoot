import { PATREON_CLIENT_ID, PATREON_REDIRECT_URI } from "../config";
import { apiService, isError } from "../services/apiService";
import { faInfoCircle, faUnlink } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState } from "react";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Line } from "rc-progress";
import OBR from "@owlbear-rodeo/sdk";
import ReactModal from "react-modal";
import Toggle from "react-toggle";
import { User } from "../types/user";
import { byteSize } from "../utils";
import { faPatreon } from "@fortawesome/free-brands-svg-icons";
import { useAuth } from "../components/AuthProvider";
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

    return <form className="login-form" action="#" onSubmit={handleLogin}>
        <label htmlFor="email">
            <p className="bold">Email</p>
            <input
                style={{textAlign: "left"}}
                name="email"
                value={email}
                type="email"
                onChange={e => setEmail(e.target.value)}
            />
        </label>
        <br></br>
        <label htmlFor="password">
            <p className="bold">Password</p>
            <input
                style={{textAlign: "left"}}
                name="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
            />
        </label>
        <br></br>
        <div style={{display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-evenly"}}>
            <button disabled={email == "" || password == ""} type="submit">
                <p className="bold text-medium">Log In</p>
            </button>
            <p style={{marginLeft: "1rem"}}>
                Or <a href="/signup" target="_blank" style={{color: "white", fontWeight: "bold"}}>create your account</a>
            </p>
        </div>
    </form>;
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

    const [ fadeInputValue, setFadeInputValue ] = useState("");
    const [ invalidFadeValue, setInvalidFadeValue ] = useState(false);
    const [ openedModal, setModalOpened ] = useState<ModalType|null>(null);
    const [ isModalClosing, setIsModalClosing ] = useState(false);

    const { status, user, doLogin, doLogout, refresh } = useAuth();

    const closeModal = () => {
        setIsModalClosing(true);
        setTimeout(() => {
            setModalOpened(null);
            setIsModalClosing(false);
        }, 300);
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = event.target.value;
        if (/^\d*$/.test(newValue)) {
            setFadeInputValue(newValue);
            const int = parseInt(newValue);
            if (isNaN(int) || int <= 0) {
                setInvalidFadeValue(true);
            }
            else {
                setInvalidFadeValue(false);
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
    
    return <div className="generic-view">
        <div className="generic-view-inner">
            <div className="setting-row">
                <label htmlFor="enable-autoplay" className="setting-label">Enable autoplay</label>
                <Toggle id="enable-autoplay" checked={enableAutoplay} onChange={event => setEnableAutoplay(event.target.checked)} type="checkbox" />
            </div>
            <div className="setting-row">
                <label htmlFor="stop-old-tracks" className="setting-label">Stop old tracks when autoplaying</label>
                <Toggle id="stop-old-tracks" checked={stopOtherTracks} onChange={event => setStopOtherTracks(event.target.checked)} type="checkbox" />
            </div>
            <div className="setting-row">
                <label htmlFor="fade-time" className="setting-label">Fade in/out time</label>
                <div className="setting-value">
                    <input id="fade-time" className={`small-input ${invalidFadeValue ? "invalid-value" : ""}`} value={fadeInputValue} onChange={handleChange} /> ms
                </div>
            </div>
            <br></br>
            <div className="settings-profile">
                <hr></hr>
                <div>
                    <h2>Profile</h2>
                    {
                        status === "LOGGED_OUT" && <>
                            <p>Login to host your tracks directly in Hoot, and sync across all devices.</p>
                            <br></br>
                            <LoginForm onLogin={doLogin}></LoginForm>
                        </>
                    }
                    {
                        status === "LOGGED_IN" && user && <>
                            <div style={{display: "flex", flexDirection: "row"}}>
                                <p className="bold">Username:</p>
                                <p style={{marginLeft: ".5rem"}}>{ user.username }</p>
                            </div>
                            <div style={{display: "flex", flexDirection: "row"}}>
                                <p className="bold">Email:</p>
                                <p style={{marginLeft: ".5rem"}}>{ user.email }</p>
                            </div>
                            <div style={{display: "flex", flexDirection: "row"}}>
                                <p className="bold">Subscription:</p>
                                <p style={{marginLeft: ".5rem"}}>{ user.patreon_member ? "Patreon Member" : "Free" }</p>
                                <p
                                    style={{marginLeft: ".5rem"}}
                                    className="clickable"
                                    title="Become a Patreon member to have access to 10GB of storage!"
                                    onClick={() => setModalOpened("PATREON")}
                                >
                                    <FontAwesomeIcon icon={faInfoCircle} />
                                </p>
                            </div>
                            <br></br>
                            <div style={{display: "flex", flexDirection: "row"}}>
                                <p className="bold">Usage:</p>
                                <p style={{marginLeft: ".5rem"}}>{ `${byteSize(user.used_storage)} / ${byteSize(user.total_storage)}` }</p>
                            </div>
                            <div title={`Usage: ${byteSize(user.used_storage)} / ${byteSize(user.total_storage)}`}>
                                <Line
                                    percent={user.used_storage / user.total_storage * 100}
                                    strokeWidth={4}
                                    trailWidth={4}
                                />
                            </div>
                            <div style={{paddingTop: "2rem", display: "flex", justifyContent: "space-evenly"}}>
                                <button onClick={handleLogout}>
                                    <p className="bold text-medium">Log out</p>
                                </button>
                                {
                                    user.patreon_link &&
                                    <button onClick={() => setModalOpened("UNLINK_PATREON")}>
                                        <p className="bold text-medium"><FontAwesomeIcon icon={faPatreon} /> Unlink Patreon</p>
                                    </button>
                                }
                                {
                                    !user.patreon_link &&
                                    <a href={PATREON_URL} target="_blank">
                                        <button>
                                            <p className="bold text-medium"><FontAwesomeIcon icon={faPatreon} /> Link to Patreon</p>
                                        </button>
                                    </a>
                                }
                            </div>
                        </>
                    }
                </div>
            </div>
        </div>
        <ReactModal
            isOpen={openedModal === "PATREON"}
            onRequestClose={closeModal}
            contentLabel="Patreon Membership"
            overlayClassName={`modal-overlay ${
                isModalClosing ? "fade-out" : ""
            }`}
            className={`modal-content ${isModalClosing ? "fade-out" : ""}`}
            >
            <h2>Patreon Membership</h2>
            <p>
                If 2GB of storage aren't enough for you, or you just want to support my work
                on Hoot and other extensions, you can <a href="https://www.patreon.com/Armindoflores" target="_blank">
                become a Patreon member</a>.
            </p>
            <p>
                Patreon members have access to 10GB of storage. For more information, please read
                the <a href="/tos" target="_blank">terms of service</a>.
            </p>
        </ReactModal>
        <ReactModal
            isOpen={openedModal === "UNLINK_PATREON"}
            onRequestClose={closeModal}
            contentLabel="Unlink Patreon"
            overlayClassName={`modal-overlay ${
                isModalClosing ? "fade-out" : ""
            }`}
            className={`modal-content ${isModalClosing ? "fade-out" : ""}`}
            >
            <h2>Unlink Patreon</h2>
            <p>
                Are you sure you want to unlink Patreon from your Hoot account?
                You will lose all your benefits, even if you're still a member!
            </p>
            <br></br>
            <div style={{display: "flex", flexDirection: "row", alignContent: "center", justifyContent: "center"}}>
                <button style={{marginRight: "1rem"}} onClick={() => { unlinkFromPatreon(); closeModal(); }}>
                    <p className="bold text-medium"><FontAwesomeIcon icon={faUnlink} /> Unlink</p>
                </button>  
                <button onClick={() => closeModal()}>
                    <p className="bold text-medium">Cancel</p>
                </button>  
            </div>
        </ReactModal>
    </div>;
}
