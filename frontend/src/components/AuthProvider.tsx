import React, { createContext, useContext, useEffect, useState } from "react";

type AuthStatus = "LOGGED_IN" | "LOGGED_OUT";

interface AuthContextType {
    status: AuthStatus;
    username?: string;
}

const AuthContext = createContext<AuthContextType>({
    status: "LOGGED_OUT",
});
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode, proxy: boolean }) {
    const [ status, setStatus ] = useState<AuthStatus>("LOGGED_OUT");
    const [ username, setUsername ] = useState<string>();

    useEffect(() => {
        // check status
    }, []);

    return <AuthContext.Provider
        value={{
            status,
            username,
        }}
    >
        { children }
    </AuthContext.Provider>;
}
