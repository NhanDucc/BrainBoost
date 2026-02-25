import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import defaultAvatar from "../images/defaultAvatar.png";
import { useNavigate } from "react-router-dom";
import { toAbsolute } from "../utils/url";
import "../css/Profile.css";

// List of subjects displayed on the dashboard tables and practice tabs
const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "English"];

/**
 * Formats a Date object to a standard YYYY-MM-DD string using local time.
 * This prevents date-shifting issues caused by UTC timezone differences.
 * @param {Date} d - The date object to format.
 * @returns {String} Formatted date string (e.g., "2023-10-25").
 */
function fmtDateLocal(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Builds a 6x7 grid (42 days) for the mini calendar view.
 * It calculates the offset to ensure the calendar always starts on a Monday.
 * @param {Number} year - The target year.
 * @param {Number} month - The target month (0-indexed).
 * @returns {Array<Date>} Array of Date objects representing the 42-cell grid.
 */
function buildMonth(year, month) {
    const first = new Date(year, month, 1);
    const start = new Date(first);
    const offset = (first.getDay() + 6) % 7; // Monday-first calculation
    start.setDate(1 - offset);
    const grid = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        grid.push(d);
    }
    return grid;
}

/**
 * Default empty data structure for the weekly statistics table.
 * Used as a fallback if the user has no study data for the current week.
 */
const defaultWeekStats = [
    { day: "Mon", Mathematics: 0, Physics: 0, Chemistry: 0, English: 0, minutes: 0 },
    { day: "Tue", Mathematics: 0, Physics: 0, Chemistry: 0, English: 0, minutes: 0 },
    { day: "Wed", Mathematics: 0, Physics: 0, Chemistry: 0, English: 0, minutes: 0 },
    { day: "Thu", Mathematics: 0, Physics: 0, Chemistry: 0, English: 0, minutes: 0 },
    { day: "Fri", Mathematics: 0, Physics: 0, Chemistry: 0, English: 0, minutes: 0 },
    { day: "Sat", Mathematics: 0, Physics: 0, Chemistry: 0, English: 0, minutes: 0 },
    { day: "Sun", Mathematics: 0, Physics: 0, Chemistry: 0, English: 0, minutes: 0 },
];

/**
 * Component for the Student Dashboard view.
 * Renders the diligence calendar, weekly study summary table, and practice history.
 */
function StudentDashboard({ user }) {
    const today = new Date();
    const navigate = useNavigate();

    // Extract dynamic study data from the user profile, fallback to defaults if missing
    const submittedDays = user?.study?.submittedDays || [];
    const weekStats = user?.weekStats || defaultWeekStats;
    const history = user?.practiceHistory || [];

    // Calendar state
    const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [currentDate, setCurrentDate] = useState(new Date(today));
    
    // Tab state for the practice history section
    const [activeTab, setActiveTab] = useState("Mathematics");

    // Memoize the calendar grid calculation so it only runs when the month changes
    const monthCells = useMemo(() => buildMonth(month.getFullYear(), month.getMonth()), [month]);

    // Calculate total study minutes across all days in the week
    const minutesTotal = weekStats.reduce((t, r) => t + (r.minutes || 0), 0);

    /**
     * Resets the calendar view back to the current real-world month and day.
     */
    const handleTodayClick = () => {
        const todayObj = new Date();
        setMonth(new Date(todayObj.getFullYear(), todayObj.getMonth(), 1));
        setCurrentDate(todayObj);
    };

    // Filter the user's test history based on the currently selected subject tab
    const displayedHistory = history.filter(h => h.subject === activeTab);

    return (
        <>
        {/* TOP GRID: Calendar & Weekly Stats */}
        <div className="stu-grid">

            {/* Left column: Diligence Calendar */}
            <div className="col-left">
                <div className="dash-card">
                    <div className="card-head">
                        <div className="title">Your diligence calendar</div>
                        <div className="hint">
                            <span className="dot green" /> Submitted
                        </div>
                    </div>

                    <div className="calendar-bar">
                        <button className="nav" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                            ‹
                        </button>
                        <div className="month-title">
                            {month.toLocaleString("en-US", { month: "long" })} {month.getFullYear()}
                        </div>
                        <button className="nav" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
                            ›
                        </button>

                        <button className="go-today" onClick={handleTodayClick}>Today</button>
                    </div>

                    <div className="calendar-grid">
                        {/* Days of the week header */}
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                            <div key={d} className="dow">{d}</div>
                        ))}

                        {/* 42-day calendar grid */}
                        {monthCells.map((d, i) => {
                            const inMonth = d.getMonth() === month.getMonth();
                            const isToday = fmtDateLocal(d) === fmtDateLocal(currentDate);

                            // Check if the specific date exists in the backend 'submittedDays' array
                            const submitted = submittedDays.includes(fmtDateLocal(d));

                            const cellClass =  `cal-cell ${inMonth ? "" : "dim"} ${isToday ? "today" : ""} ${submitted ? "submitted" : ""}`

                            return (
                            <div key={i} className={cellClass}>
                                <span className={`num ${isToday ? "today" : ""}`}>{d.getDate()}</span>
                            </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Right column: Weekly Study Summary Table */}
            <div className="col-right">
                <div className="dash-card">
                    <div className="card-head">
                        <div className="title">Weekly study summary</div>
                    </div>

                    <div className="table-wrap">
                        <table className="wk-table">
                            <thead>
                                <tr>
                                    <th>Day</th>
                                    {SUBJECTS.map((s) => <th key={s}>{s}</th>)}
                                    <th>Study time</th>
                                </tr>
                            </thead>

                            <tbody>
                                {weekStats.map((row, i) => (
                                    <tr key={i}>
                                    <td>{row.day}</td>
                                    {SUBJECTS.map((s) => <td key={s}>{row[s] || 0}</td>)}
                                    <td>{Math.floor((row.minutes || 0) / 60)}h {(row.minutes || 0) % 60}m</td>
                                    </tr>
                                ))}
                            </tbody>

                            <tfoot>
                                <tr>
                                    <td>Total</td>
                                    {SUBJECTS.map((s) => (
                                    <td key={s}>{weekStats.reduce((t, r) => t + (r[s] || 0), 0)}</td>
                                    ))}
                                    <td>{Math.floor(minutesTotal / 60)}h {minutesTotal % 60}m</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        {/* BOTTOM SECTION: Practice History */}
        <div className="dash-card mt">
            <div className="card-head"><div className="title">Practice history</div></div>
            
            {/* Dynamic Subject Tabs */}
            <div className="tabs">
                {SUBJECTS.map(sub => (
                    <button 
                        key={sub}
                        className={`tab ${activeTab === sub ? "active" : ""}`}
                        onClick={() => setActiveTab(sub)}
                    >
                        {sub}
                    </button>
                ))}
            </div>

            {/* List of completed tests based on active tab */}
            {displayedHistory.length === 0 ? (
                <div className="empty">
                    <div>You have no practice history for {activeTab} yet. Pick a subject and start now!</div>
                    <button className="cta-ghost" onClick={() => navigate('/tests')}>Start practicing</button>
                </div>
            ) : (
                <div className="recent-list">
                    {displayedHistory.map(item => (
                        <div key={item.id} className="recent-item">
                            <div className="r-main">
                                <div className="r-title">{item.title}</div>
                                <div className="r-sub">
                                    <span className="chip" style={{ color: item.percent >= 50 ? '#15803d' : '#b91c1c' }}>
                                        Score: {item.score}/{item.maxScore} ({item.percent}%)
                                    </span>
                                    <span className="chip"><i className="bi bi-clock"></i> {item.timeSpent} mins</span>
                                    <span className="chip"><i className="bi bi-calendar-event"></i> {new Date(item.completedAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="r-actions" style={{ display: 'flex', gap: '8px' }}>
                                <button className="primary-btn" onClick={() => navigate(`/results/${item.id}`)} style={{ padding: '8px 12px', fontSize: '13px' }}>
                                    <i className="bi bi-eye"></i> View Details
                                </button>
                                
                                <button className="ghost-btn" onClick={() => navigate(`/tests/public/${item.testId}`)}>
                                    <i className="bi bi-arrow-repeat"></i> Practice Again
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
        </>
    );
}

/**
 * Main Profile Page Component.
 * Fetches the user profile, determines their role, and conditionally renders 
 * the appropriate dashboard layout (Student, Instructor, or Admin).
 */
export default function Profile() {
    const navigate = useNavigate();

    // Global user state
    const [user, setUser] = useState({
        fullname: "Name",
        avatarUrl: "",
        bannerUrl: "",
        role: null,
    });
    const [error] = useState("");

    // Fetch user profile data on component mount
    useEffect(() => {
        (async () => {
        try {
            const res = await api.get("/users/me");
            const u = res.data?.user || res.data || {};
            setUser({
                fullname: u.fullname || "Name",
                avatarUrl: u.avatarUrl || "",
                bannerUrl: u.bannerUrl || "",
                updatedAt: u.updatedAt,
                role: u.role || "student",
                study: u.study,
                weekStats: u.weekStats,
                practiceHistory: u.practiceHistory,
            });
        } catch {
            /* Silently ignore API failures on initial load; let UI handle empty state */
        }
        })();
    }, []);

    // Computed boolean flags for role-based rendering
    const role = user.role || "student";
    const isStudent = role === "student";
    const isInstructor = role === "instructor";
    const isAdmin = role === "admin";

    // Prepare media URLs, using fallbacks if the user hasn't uploaded custom images
    const rawAvatar = user?.avatarUrl || defaultAvatar;
    const avatarSrc = user?.avatarUrl ? rawAvatar : defaultAvatar;
    const bannerSrc = user?.bannerUrl || "https://via.placeholder.com/1200x300?text=Cover+Image";

    // State exclusively for Instructors to track tests they have authored
    const [myTests, setMyTests] = useState([]);
    const [itLoading, setItLoading] = useState(false);

    // Fetch authored tests if the user is an instructor
    useEffect(() => {
        if (user.role !== "instructor") return;
        (async () => {
            try {
                setItLoading(true);
                const res = await fetch(toAbsolute("/api/tests?mine=1"), { credentials: "include" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                setMyTests(Array.isArray(data) ? data : []);
            } catch (e) {
                // Ignore gracefully; could implement a toast notification here
            } finally {
                setItLoading(false);
            }
        })();
        }, [user.role]);

    // Compute aggregate statistics for the Instructor view
    const testsTotal = myTests.length;
    const questionsTotal = myTests.reduce((t, x) => t + (x.numQuestions || (x.questions?.length || 0)), 0);
    const subjectSet = new Set(myTests.map(t => t.subject));
    const recent = myTests.slice(0, 5); // Grab only the 5 most recent tests

    return (
        <div className="profile-page">
        <SiteHeader />

        <div className="profile-container">
            {/* Cover Image */}
            <div className="profile-cover">
            <img
                src={bannerSrc}
                alt="Cover"
                className="cover-fake-image"
            />
            </div>

            {/* Avatar & Name */}
            <div className="profile-head">
            <div className="profile-avatar-wrapper">
                <img src={avatarSrc} alt="avatar" className="profile-avatar" />
                <button
                    type="button"
                    className="information-edit-btn"
                    onClick={() => navigate("/update-profile")}
                    aria-label="Edit profile"
                    title="Edit profile"
                    >
                    <i className="bi bi-pencil-fill" />
                </button>
            </div>
            <div className="profile-name">{user.fullname || "Name"}</div>
            <div className="profile-role-chip">{role}</div>
            </div>

            {error && <div className="profile-error">{error}</div>}

            {/* ==== STUDENT VIEW ==== */}
            {isStudent && (
            <StudentDashboard user={user} />
            )}

            {/* ==== INSTRUCTOR VIEW ==== */}
            {isInstructor && (
            <div className="role-section">

                {/* Quick Action Links */}
                <div className="role-card">
                <h3>Instructor quick actions</h3>
                <div className="qa-row">
                    <button className="primary-btn" onClick={() => navigate("/instructor")}>
                    <i className="bi bi-speedometer2" /> Go to Instructor Dashboard
                    </button>
                    <button className="ghost-btn" onClick={() => navigate("/instructor/tests/new")}>
                    <i className="bi bi-plus-lg" /> Add New Test
                    </button>
                </div>
                <p className="role-muted">Create and manage tests from your dashboard.</p>
                </div>

                {/* KPI Statistics */}
                <div className="role-cards-3">
                <div className="stat-card">
                    <div className="stat-kpi">{testsTotal}</div>
                    <div className="stat-label">Total Tests</div>
                </div>
                <div className="stat-card">
                    <div className="stat-kpi">{questionsTotal}</div>
                    <div className="stat-label">Total Questions</div>
                </div>
                <div className="stat-card">
                    <div className="stat-kpi">{subjectSet.size}</div>
                    <div className="stat-label">Subjects Authored</div>
                </div>
                </div>

                {/* List of Recent Authored Tests */}
                <div className="role-card">
                <div className="role-card-head">
                    <h4>Recent tests</h4>
                    <button className="link-btn" onClick={() => navigate("/instructor")}>View all</button>
                </div>

                {itLoading ? (
                    <div className="empty">Loading…</div>
                ) : recent.length === 0 ? (
                    <div className="empty">
                    You haven’t published any tests yet.
                    <button className="cta-ghost" onClick={() => navigate("/instructor/tests/new")}>
                        + Add New Test
                    </button>
                    </div>
                ) : (
                    <div className="recent-list">
                    {recent.map(t => (
                        <div key={t._id} className="recent-item">
                        <div className="r-main">
                            <div className="r-title">{t.title}</div>
                            <div className="r-sub">
                            <span className="chip">{(t.subject || "").toUpperCase()}</span>
                            {t.grade && <span className="chip">Grade {t.grade}</span>}
                            <span className="chip">{t.numQuestions || (t.questions?.length || 0)} Qs</span>
                            </div>
                        </div>
                        <div className="r-actions">
                            <button className="ghost-btn" onClick={() => navigate(`/instructor/tests/${t._id}/edit`)}>
                            <i className="bi bi-pencil-square" /> Edit
                            </button>
                        </div>
                        </div>
                    ))}
                    </div>
                )}
                </div>
            </div>
            )}

            {/* ==== ADMIN VIEW ==== */}
            {isAdmin && (
            <div className="role-section">
                <div className="role-card">
                <h3>Admin console (coming soon)</h3>
                <p className="role-muted">
                    Here you will manage users, courses, reports, and platform settings.
                </p>
                </div>
                <div className="role-card">
                <h4>Quick links</h4>
                <ul className="role-list">
                    <li>User management</li>
                    <li>Course review queue</li>
                    <li>System metrics</li>
                </ul>
                </div>
            </div>
            )}
        </div>

        <SiteFooter />
        </div>
    );
}