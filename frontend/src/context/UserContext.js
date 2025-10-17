import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../api";

const UserContext = createContext(null);
export const useUser = () => useContext(UserContext);

const safeReadCachedUser = () => {
    const raw = localStorage.getItem("bb_user");
    if (!raw || raw === "undefined" || raw === "null") return null;
    try { return JSON.parse(raw); } catch { localStorage.removeItem("bb_user"); return null; }
};

export function UserProvider({ children }) {
    const [user, setUser] = useState(safeReadCachedUser);
    const [authResolved, setAuthResolved] = useState(false); // <— NEW

    const setUserEverywhere = useCallback((u) => {
        if (!u) {
        setUser(null);
        localStorage.removeItem("bb_user");
        return;
        }
        setUser(u);
        localStorage.setItem("bb_user", JSON.stringify(u));
    }, []);

    const signOut = () => {
        setUser(null);
        localStorage.removeItem("bb_user");
    };

    const fetchMe = useCallback(async () => {
        try {
        const res = await api.get("/users/me");
        const u = res.data?.user || res.data || null;
        setUserEverywhere(u);
        } catch {
        signOut();
        } finally {
        setAuthResolved(true); // <— mark done
        }
    }, [setUserEverywhere]);

    useEffect(() => { fetchMe(); }, [fetchMe]);

    return (
        <UserContext.Provider value={{ user, authResolved, setUser: setUserEverywhere, fetchMe, signOut }}>
        {children}
        </UserContext.Provider>
    );
}
