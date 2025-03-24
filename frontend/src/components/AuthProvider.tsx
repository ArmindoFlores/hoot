import { apiService, isError } from "../services/apiService";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import OBR from "@owlbear-rodeo/sdk";
import { User } from "../types/user";

type AuthStatus = "LOGGED_IN" | "LOGGED_OUT";

interface AuthContextType {
    status: AuthStatus;
    user?: User;
    doLogin: (user: User) => void;
    doLogout: () => void;
}

const AuthContext = createContext<AuthContextType>({
    status: "LOGGED_OUT",
    doLogin: () => {},
    doLogout: () => {},
});
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode, proxy: boolean }) {
    const [ status, setStatus ] = useState<AuthStatus>("LOGGED_OUT");
    const [ user, setUser ] = useState<User>();

    useEffect(() => {
        apiService.getProfile().then(result => {
            if (isError(result)) {
                if (result.error.startsWith("Logged out")) {
                    setStatus("LOGGED_OUT");
                    return;
                }
                throw new Error(result.error);
            }
            setStatus("LOGGED_IN");
            setUser(result);
        }).catch((error: Error) => {
            console.error(error);
            OBR.notification.show(`Couldn't fetch user data (${error.message})`);
        });
    }, []);
    
    const doLogin = useCallback((user: User) => {
        setStatus("LOGGED_IN");
        setUser(user);
    }, []);

    const doLogout = useCallback(() => {
        setStatus("LOGGED_OUT");
    }, []);

    return <AuthContext.Provider
        value={{
            status,
            user,
            doLogin,
            doLogout
        }}
    >
        { children }
    </AuthContext.Provider>;
}
