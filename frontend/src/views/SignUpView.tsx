import { apiService, isError } from "../services/apiService";

import { logging } from "../logging";
import { useState } from "react";

export function SignUpView() {
    const [created, setCreated] = useState(false);
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const handleLogin = () => {
        apiService.signup(email, username, password, confirmPassword).then(result => {   
            if (isError(result)) {
                throw new Error(result.error);
            }
            setCreated(true);
        }).catch((error: Error) => {
            logging.error(error);
            alert(error.message);
        }).finally(() => {
            setPassword("");
            setConfirmPassword("");
        });
    };

    if (created) {
        return <div className="external-website-container">
            <div className="external-website-container-filter">
                <div className="external-website-container-inner">
                    <h1>Sign Up</h1>
                    <br></br>
                    <p>Your account has been created! To finalize that process, please check your email inbox and verify your account.</p>
                </div>
            </div>
        </div>;
    }

    return <div className="external-website-container">
        <div className="external-website-container-filter">
            <div className="external-website-container-inner">
                <h1>Sign Up</h1>
                <br></br>
                <div style={{display: "flex", flexDirection: "column", alignItems: "center"}}>
                <label style={{display: "flex", flexDirection: "column", alignItems: "flex-start"}} htmlFor="email">
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
                    <label style={{display: "flex", flexDirection: "column", alignItems: "flex-start"}} htmlFor="username">
                        <p className="bold">Username</p>
                        <input
                            style={{textAlign: "left"}}
                            name="username"
                            value={username}
                            type="text"
                            onChange={e => setUsername(e.target.value)}
                        />
                    </label>
                    <br></br>
                    <label style={{display: "flex", flexDirection: "column", alignItems: "flex-start"}} htmlFor="password">
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
                    <label style={{display: "flex", flexDirection: "column", alignItems: "flex-start"}} htmlFor="confirm-password">
                        <p className="bold">Confirm password</p>
                        <input
                            style={{textAlign: "left"}}
                            name="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                        />
                    </label>
                    <br></br>
                    <div style={{display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-evenly"}}>
                        <button disabled={email == "" || password == ""} onClick={handleLogin}>
                            <p className="bold text-medium">Sign Up</p>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>;
}
