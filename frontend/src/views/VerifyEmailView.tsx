import { apiService, isError } from "../services/apiService";
import { useEffect, useState } from "react";

import { useParams } from "react-router-dom";

export function VerifyEmailView() {
    const { verificationCode } = useParams();
    const [error, setError] = useState("");
    const [status, setStatus] = useState<"pending"|"success"|"failure">("pending");

    useEffect(() => {
        if (verificationCode == undefined) return;
        
        setStatus("pending");
        apiService.verifyEmail(verificationCode).then(result => {
            if (isError(result)) {
                throw new Error(result.error);
            }
            setStatus("success");
        }).catch((error: Error) => {
            console.error(error);
            setStatus("failure");
            setError(error.message);
        })
    }, [verificationCode]);

    return <div className="external-website-container">
        <div className="external-website-container-inner">
        <h1>Email Verification</h1>
        {
                status === "pending" && <p>
                    Verifying your email...
                </p>
            }
            {
                status === "success" && <p>
                    Successfully verified your email. You may now close this page and log in.
                </p>
            }
            {
                status === "failure" && <p>
                    An error occurred while verifying your email: <span style={{fontStyle: "italic"}}>{ error }</span>
                </p>
            }
        </div>
    </div>;
}