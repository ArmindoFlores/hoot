import { apiService, createQueryFn } from "../services/apiService";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { User } from "../types/user";
import { useQuery } from "@tanstack/react-query";

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

    const authStatus = useQuery({
        queryKey: ["auth-status"],
        queryFn: createQueryFn(apiService.getProfile)
    });
    
    const doLogin = useCallback((user: User) => {
        setStatus("LOGGED_IN");
        setUser(user);
    }, []);

    const doLogout = useCallback(() => {
        setStatus("LOGGED_OUT");
    }, []);

    useEffect(() => {
        if (authStatus.data == undefined) {
            return;
        }
        setStatus("LOGGED_IN");
        setUser(authStatus.data);
    }, [authStatus.data])

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
