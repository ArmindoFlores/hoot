import { apiService, isError } from "../services/apiService";
import { useEffect, useState } from "react";

import { Line } from "rc-progress";
import OBR from "@owlbear-rodeo/sdk";
import Toggle from "react-toggle";
import { User } from "../types/user";
import { byteSize } from "../utils";
import { useAuth } from "../components/AuthProvider";
import { useSettings } from "../components/SettingsProvider";

function LoginForm({ onLogin }: { onLogin: (user: User) => void }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = () => {
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

    return <div className="login-form">
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
            <button disabled={email == "" || password == ""} onClick={handleLogin}>
                <p className="bold text-medium">Log In</p>
            </button>
            <p style={{marginLeft: "1rem"}}>
                Or <a href="/signup" target="_blank" style={{color: "white", fontWeight: "bold"}}>create your account</a>
            </p>
        </div>
    </div>;
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

    const { status, user, doLogin, doLogout } = useAuth();

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
                                <p style={{paddingLeft: ".5rem"}}>{ user.username }</p>
                            </div>
                            <div style={{display: "flex", flexDirection: "row"}}>
                                <p className="bold">Email:</p>
                                <p style={{paddingLeft: ".5rem"}}>{ user.email }</p>
                            </div>
                            <div style={{display: "flex", flexDirection: "row"}}>
                                <p className="bold">Subscription:</p>
                                <p style={{paddingLeft: ".5rem"}}>Free</p>
                            </div>
                            <br></br>
                            <div style={{display: "flex", flexDirection: "row"}}>
                                <p className="bold">Usage:</p>
                                <p style={{paddingLeft: ".5rem"}}>{ `${byteSize(user.used_storage)} / ${byteSize(user.total_storage)}` }</p>
                            </div>
                            <div title={`Usage: ${byteSize(user.used_storage)} / ${byteSize(user.total_storage)}`}>
                                <Line
                                    percent={user.used_storage / user.total_storage * 100}
                                    strokeWidth={4}
                                    trailWidth={4}
                                />
                            </div>
                            <div style={{paddingTop: "2rem", display: "flex", justifyContent: "center"}}>
                                <button onClick={handleLogout}>
                                    <p className="bold text-medium">Log out</p>
                                </button>
                            </div>
                        </>
                    }
                </div>
            </div>
        </div>
    </div>;
}
