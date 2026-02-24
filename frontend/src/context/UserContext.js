import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../api";

const UserContext = createContext(null);
export const useUser = () => useContext(UserContext);

// Function to apply the theme globally to the HTML tag
const applyTheme = (theme) => {
    if (theme) {
        document.documentElement.setAttribute('data-theme', theme);
    } else {
        document.documentElement.setAttribute('data-theme', 'light'); // Default fallback
    }
};

const safeReadCachedUser = () => {
    const raw = localStorage.getItem("bb_user");
    if (!raw || raw === "undefined" || raw === "null") return null;
    try { 
        const parsedUser = JSON.parse(raw); 
        // Apply theme immediately if available in cache to prevent light-mode flash
        applyTheme(parsedUser?.preferences?.theme);
        return parsedUser;
    } catch { 
        localStorage.removeItem("bb_user"); 
        return null; 
    }
};

export function UserProvider({ children }) {
    const [user, setUser] = useState(safeReadCachedUser);
    const [authResolved, setAuthResolved] = useState(false);

    const setUserEverywhere = useCallback((u) => {
        if (!u) {
            setUser(null);
            localStorage.removeItem("bb_user");
            applyTheme('light'); // Reset theme on logout
            return;
        }
        setUser(u);
        localStorage.setItem("bb_user", JSON.stringify(u));
        
        // Apply theme whenever user data is updated
        applyTheme(u.preferences?.theme);
    }, []);

    const signOut = () => {
        setUser(null);
        localStorage.removeItem("bb_user");
        applyTheme('light'); // Reset theme on logout
    };

    const fetchMe = useCallback(async () => {
        try {
            const res = await api.get("/users/me");
            const u = res.data?.user || res.data || null;
            setUserEverywhere(u);
        } catch {
            signOut();
        } finally {
            setAuthResolved(true);
        }
    }, [setUserEverywhere]);

    useEffect(() => { fetchMe(); }, [fetchMe]);

    return (
        <UserContext.Provider value={{ user, authResolved, setUser: setUserEverywhere, fetchMe, signOut }}>
            {children}
        </UserContext.Provider>
    );
}