import { useEffect, useState } from "react";
import { api } from "../api";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import defaultAvatar from "../images/defaultAvatar.png";
import { useNavigate } from "react-router-dom";
import StudentDashboard from "../components/profile/StudentDashboard";
import InstructorOverview from "../components/profile/InstructorOverview";
import AdminOverview from "../components/profile/AdminOverview";
import "../css/Profile.css";

// ==== Caching Helper ====

/**
 * Synchronously retrieves data from sessionStorage.
 * Used to load the initial state immediately, preventing a blank screen or loading spinner
 * if the user has visited their profile recently.
 */
const getCache = (key, fallback) => {
    try { const item = sessionStorage.getItem(key); return item ? JSON.parse(item) : fallback; } 
    catch { return fallback; }
};

export default function Profile() {
    const navigate = useNavigate();
    
    // ---- State Management ----
    const [user, setUser] = useState(() => getCache("profile_user", null));
    const [loading, setLoading] = useState(!user);
    const [error, setError] = useState("");

    // ---- Data Fetching ----

    // Fetches fresh data from the server in the background to ensure the UI is up-to-date
    useEffect(() => {
        // Flag to prevent state updates if the component unmounts
        let isCancelled = false;

        api.get("/users/me").then(res => {
            const u = res.data?.user || res.data || {};
            const formattedUser = {
                fullname: u.fullname || "Name",
                avatarUrl: u.avatarUrl || "",
                bannerUrl: u.bannerUrl || "",
                updatedAt: u.updatedAt,
                role: u.role || "student",
                study: u.study,
                weekStats: u.weekStats,
                practiceHistory: u.practiceHistory,
            };
            if (!isCancelled) {
                setUser(formattedUser);
                // Update the cache with the fresh data for the next visit
                sessionStorage.setItem("profile_user", JSON.stringify(formattedUser));
                setLoading(false);
            }
        }).catch(() => {
            if (!isCancelled) {
                setError("Failed to load profile");
                setLoading(false);
            }
        });

        return () => { isCancelled = true; };
    }, []);

    // Renders a Skeleton UI that perfectly matches the dimensions of the actual content.
    // This prevents the page layout from "jumping" when the network data finally loads.
    if (loading && !user && !error) {
        return (
            <div className="profile-page">
                <SiteHeader />
                <div className="profile-container">
                    {/* Skeleton Cover */}
                    <div className="profile-cover skeleton" style={{ border: 'none' }}></div>

                    {/* Skeleton Avatar and Name */}
                    <div className="profile-head">
                        <div className="profile-avatar-wrapper skeleton" style={{ borderRadius: '50%', border: '6px solid var(--bg-card)', zIndex: 1 }}></div>
                        <div className="skeleton" style={{ width: '180px', height: '28px', marginTop: '20px', borderRadius: '6px' }}></div>
                        <div className="skeleton" style={{ width: '80px', height: '26px', marginTop: '8px', borderRadius: '999px' }}></div>
                    </div>

                    {/* Skeleton Content Placeholder */}
                    <div className="skeleton" style={{ width: '100%', height: '350px', borderRadius: '16px', marginTop: '24px' }}></div>
                </div>
                <SiteFooter />
            </div>
        );
    }

    // ---- Derived Variables ----
    const role = user?.role || "student";
    const rawAvatar = user?.avatarUrl || defaultAvatar;
    const bannerSrc = user?.bannerUrl || "https://via.placeholder.com/1200x300?text=Cover+Image";

    return (
        <div className="profile-page">
            <SiteHeader />
            <div className="profile-container">

                {/* ==== Profile Cover ==== */}
                <div className="profile-cover">
                    <img src={bannerSrc} alt="Cover" className="cover-fake-image" fetchpriority="high" />
                </div>

                {/* ==== Avatar & Info ==== */}
                <div className="profile-head">
                    <div className="profile-avatar-wrapper">
                        <img 
                            src={rawAvatar} 
                            alt="avatar" 
                            className="profile-avatar" 
                            onError={(e) => { e.target.onerror = null; e.target.src = defaultAvatar; }} 
                        />
                        <button type="button" className="information-edit-btn" onClick={() => navigate("/update-profile")} title="Edit profile">
                            <i className="bi bi-pencil-fill" />
                        </button>
                    </div>
                    <div className="profile-name">{user.fullname}</div>
                    <div className="profile-role-chip" style={{ textTransform: 'capitalize' }}>{role}</div>
                </div>

                {/* Display errors if the API request fails */}
                {error && <div className="profile-error">{error}</div>}

                {/* ==== Role-Based Sub-Routing ==== */}
                {role === "student" && <StudentDashboard user={user} />}
                {role === "instructor" && <InstructorOverview />}
                {role === "admin" && <AdminOverview />}
            </div>
            <SiteFooter />
        </div>
    );
}