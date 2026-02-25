import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import defaultAvatar from "../images/defaultAvatar.png";
import { useNavigate } from "react-router-dom";
import { toAbsolute } from "../utils/url";
import "../css/Profile.css";

// Constants ====

// List of subjects displayed on the dashboard tables and practice tabs
const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "English"];

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

// ==== Utility Functions ====

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

// Sub-Components ====

/**
 * Component for the Student Dashboard view.
 * Renders the diligence calendar, weekly study summary table, and practice history.
 */
function StudentDashboard({ user }) {
    const today = new Date();
    const navigate = useNavigate();

    // ---- Data Extraction ----
    // Extract dynamic study data from the user profile, fallback to defaults if missing
    const submittedDays = user?.study?.submittedDays || [];
    const weekStats = user?.weekStats || defaultWeekStats;
    const history = user?.practiceHistory || [];

    // ---- State Management ----
    const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [currentDate, setCurrentDate] = useState(new Date(today));
    const [activeTab, setActiveTab] = useState("Mathematics");

    // ---- Computed Values ----
    // Memoize the calendar grid calculation so it only runs when the month changes
    const monthCells = useMemo(() => buildMonth(month.getFullYear(), month.getMonth()), [month]);
    
    // Calculate total study minutes across all days in the week
    const minutesTotal = weekStats.reduce((t, r) => t + (r.minutes || 0), 0);
    
    // Filter the user's test history based on the currently selected subject tab
    const displayedHistory = history.filter(h => h.subject === activeTab);

    // ---- Event Handlers ----
    /**
     * Resets the calendar view back to the current real-world month and day.
     */
    const handleTodayClick = () => {
        const todayObj = new Date();
        setMonth(new Date(todayObj.getFullYear(), todayObj.getMonth(), 1));
        setCurrentDate(todayObj);
    };

    return (
        <>
        {/* ==== TOP GRID: Calendar & Weekly Stats ==== */}
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

        {/* ==== BOTTOM SECTION: Practice History ==== */}
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

// ==== Main Component ====

/**
 * Main Profile Page Component.
 * Fetches the user profile, determines their role, and conditionally renders 
 * the appropriate dashboard layout (Student, Instructor, or Admin).
 */
export default function Profile() {
    const navigate = useNavigate();

    // ---- Global State ----
    const [user, setUser] = useState({ fullname: "Name", avatarUrl: "", bannerUrl: "", role: null });
    const [error] = useState("");

    // ---- Instructor State ----
    const [myTests, setMyTests] = useState([]);
    const [myCourses, setMyCourses] = useState([]);
    const [itLoading, setItLoading] = useState(false);

    // ---- Admin State ----
    const [adminData, setAdminData] = useState(null);
    const [unreadMsgs, setUnreadMsgs] = useState([]);

    // Computed Role Flags
    const role = user.role || "student";
    const isStudent = role === "student";
    const isInstructor = role === "instructor";
    const isAdmin = role === "admin";

    // ==== Lifecycle Hooks ====

    // Fetch current user profile on component mount
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

    // Fetch specific instructor data if the user holds an instructor role
    useEffect(() => {
        if (!isInstructor) return;
        
        (async () => {
            try {
                setItLoading(true);

                // Fetch tests authored by the instructor (includes attempt counts)
                const resTests = await fetch(toAbsolute("/api/tests?mine=1"), { credentials: "include" });
                if (resTests.ok) {
                    const testsData = await resTests.json();
                    setMyTests(Array.isArray(testsData) ? testsData : []);
                }

                // Fetch courses authored by the instructor
                const resCourses = await fetch(toAbsolute("/api/courses?mine=1"), { credentials: "include" });
                if (resCourses.ok) {
                    const coursesData = await resCourses.json();
                    setMyCourses(Array.isArray(coursesData) ? coursesData : []);
                }
            } catch (e) {
                // Ignore gracefully; could implement a toast notification here
            } finally {
                setItLoading(false);
            }
        })();
    }, [isInstructor]);

    // Fetch specific admin data if the user holds an admin role
    useEffect(() => {
        if (!isAdmin) return;
        
        const fetchAdminInfo = async () => {
            try {
                // Fetch system KPIs and recent activity
                const statsRes = await api.get("/admin/stats");
                setAdminData(statsRes.data);
                
                // Fetch unresolved support tickets
                const msgsRes = await api.get("/contact/unread");
                setUnreadMsgs(msgsRes.data);
            } catch (err) {
                console.error("Admin fetch error", err);
            }
        };
        fetchAdminInfo();
    }, [isAdmin]);

    // ==== Event Handlers ====

    /**
     * Marks a support ticket as read in the database and updates local UI state.
     * @param {string} id - The unique ID of the contact message.
     */
    const handleMarkMsgRead = async (id) => {
        try {
            await api.put(`/contact/${id}/read`);
            setUnreadMsgs(prev => prev.filter(m => m._id !== id));
        } catch (err) {
            alert("Failed to mark as read");
        }
    };

    // ==== Derived UI Values ====

    // Prepare media URLs, using fallbacks if the user hasn't uploaded custom images
    const rawAvatar = user?.avatarUrl || defaultAvatar;
    const avatarSrc = user?.avatarUrl ? rawAvatar : defaultAvatar;
    const bannerSrc = user?.bannerUrl || "https://via.placeholder.com/1200x300?text=Cover+Image";

    // Compute aggregate statistics for the Instructor view
    const testsTotal = myTests.length;
    const coursesTotal = myCourses.length;
    const questionsTotal = myTests.reduce((t, x) => t + (x.numQuestions || (x.questions?.length || 0)), 0);
    const attemptsTotal = myTests.reduce((t, x) => t + (x.attempts || 0), 0);
    const recent = myTests.slice(0, 5); // Display only the 5 most recent tests

    // ==== Render ====

    return (
        <div className="profile-page">
        <SiteHeader />

        <div className="profile-container">
            {/* ==== Cover Image ==== */}
            <div className="profile-cover">
                <img src={bannerSrc} alt="Cover" className="cover-fake-image" />
            </div>

            {/* ==== Avatar & Profile Info ==== */}
            <div className="profile-head">
                <div className="profile-avatar-wrapper">
                    <img src={avatarSrc} alt="avatar" className="profile-avatar" />
                    <button type="button" className="information-edit-btn" onClick={() => navigate("/update-profile")} title="Edit profile">
                        <i className="bi bi-pencil-fill" />
                    </button>
                </div>
                <div className="profile-name">{user.fullname || "Name"}</div>
                <div className="profile-role-chip">{role}</div>
            </div>

            {error && <div className="profile-error">{error}</div>}

            {/* ==== STUDENT VIEW ==== */}
            {isStudent && <StudentDashboard user={user} />}

            {/* ==== INSTRUCTOR VIEW ==== */}
            {isInstructor && (
            <div className="role-section">

                {/* Instructor Quick Actions */}
                <div className="role-card">
                    <h3>Instructor quick actions</h3>
                    <div className="qa-row">
                        <button className="primary-btn" onClick={() => navigate("/instructor")}>
                            <i className="bi bi-speedometer2" /> Dashboard
                        </button>
                        <button className="ghost-btn" onClick={() => navigate("/instructor/tests/new")}>
                            <i className="bi bi-file-earmark-plus" /> Add New Test
                        </button>
                        <button className="ghost-btn" onClick={() => navigate("/instructor/courses/new")}>
                            <i className="bi bi-journal-plus" /> Add New Course
                        </button>
                    </div>
                    <p className="role-muted">Create and manage your educational content.</p>
                </div>

                {/* Instructor KPI Statistics */}
                <div className="role-cards-stats">
                    <div className="stat-card">
                        <div className="stat-kpi">{testsTotal}</div>
                        <div className="stat-label">Total Tests</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-kpi">{coursesTotal}</div>
                        <div className="stat-label">Total Courses</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-kpi">{questionsTotal}</div>
                        <div className="stat-label">Total Questions</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-kpi" style={{ color: 'var(--success)' }}>{attemptsTotal}</div>
                        <div className="stat-label">Total Attempts</div>
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
                                    <div className="r-title">
                                        {t.title} 
                                        {/* Badge hiện số lượt làm cho riêng bài này */}
                                        {t.attempts > 0 && <span style={{ fontSize: '12px', marginLeft: '10px', color: 'var(--success)' }}>({t.attempts} attempts)</span>}
                                    </div>
                                    <div className="r-sub">
                                        <span className="chip">{(t.subject || "").toUpperCase()}</span>
                                        {t.grade && <span className="chip">Grade {t.grade}</span>}
                                        <span className="chip">{t.numQuestions || (t.questions?.length || 0)} Qs</span>
                                    </div>
                                </div>
                                
                                {/* 2. THÊM NÚT XEM RESULTS / LEADERBOARD */}
                                <div className="r-actions" style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                        className="ghost-btn" 
                                        onClick={() => navigate(`/tests/public/${t._id}/leaderboard`)}
                                        title="View student results"
                                    >
                                        <i className="bi bi-trophy" /> Results
                                    </button>
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
            {isAdmin && adminData && (
            <div className="role-section">
                
                {/* Admin KPI Statistics */}
                <div className="role-cards-stats">
                    <div className="stat-card">
                        <div className="stat-kpi">{adminData.kpis.totalUsers}</div>
                        <div className="stat-label">Total Students</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-kpi">{adminData.kpis.totalInstructors}</div>
                        <div className="stat-label">Instructors</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-kpi" style={{ color: adminData.kpis.pendingApps > 0 ? 'var(--error)' : 'var(--primary)' }}>
                            {adminData.kpis.pendingApps}
                        </div>
                        <div className="stat-label">Pending Approvals</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-kpi">{adminData.kpis.totalContent}</div>
                        <div className="stat-label">Courses & Tests</div>
                    </div>
                </div>

                {/* Admin Command Center / Quick Actions */}
                <div className="role-card">
                    <h3><i className="bi bi-lightning-charge-fill"></i> Command Center</h3>
                    <div className="qa-row">
                        <button className="primary-btn" onClick={() => navigate("/admin")}>
                            <i className="bi bi-person-check-fill"></i> Review Instructors
                        </button>
                        <button className="ghost-btn" onClick={() => navigate("/admin/users")}>
                            <i className="bi bi-people-fill"></i> Manage Users
                        </button>
                        <button className="ghost-btn" onClick={() => navigate("/tests")}>
                            <i className="bi bi-collection-play-fill"></i> Manage Content
                        </button>
                    </div>
                </div>

                <div className="stu-grid" style={{ marginTop: '12px' }}>
                    {/* Unread Support Tickets */}
                    <div className="col-left">
                        <div className="dash-card">
                            <div className="card-head">
                                <div className="title" style={{ fontSize: '20px' }}>
                                    <i className="bi bi-envelope-exclamation-fill text-warning"></i> Unread Support Tickets
                                </div>
                                <span className="chip" style={{ background: 'var(--error)', color: '#fff' }}>{unreadMsgs.length} New</span>
                            </div>
                            
                            <div className="msg-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                                {unreadMsgs.length === 0 ? (
                                    <div className="empty" style={{ padding: '20px' }}>All caught up! No unread messages.</div>
                                ) : (
                                    unreadMsgs.map(msg => (
                                        <div key={msg._id} className="recent-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '8px' }}>
                                                <strong>{msg.subject}</strong>
                                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(msg.createdAt).toLocaleDateString()}</span>
                                            </div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                                From: {msg.user?.fullname} ({msg.user?.email}) - Category: {msg.category}
                                            </div>
                                            <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: '8px', fontSize: '14px', width: '100%', marginBottom: '12px' }}>
                                                {msg.message}
                                            </div>
                                            <button className="ghost-btn" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleMarkMsgRead(msg._id)}>
                                                <i className="bi bi-check2-all"></i> Mark as Read
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Recent Activity Feed */}
                    <div className="col-right">
                        <div className="dash-card">
                            <div className="card-head">
                                <div className="title" style={{ fontSize: '20px' }}><i className="bi bi-activity text-success"></i> Activity Log</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                                {adminData.recentActivity.length === 0 ? (
                                    <p className="role-muted">No recent activity.</p>
                                ) : (
                                    adminData.recentActivity.map(act => (
                                        <div key={act.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-object)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                                                <i className={act.type === 'user' ? "bi bi-person-plus-fill" : "bi bi-file-earmark-plus-fill"}></i>
                                            </div>
                                            <div>
                                                <div style={{ color: 'var(--text-main)', fontSize: '14px', fontWeight: '500' }}>{act.text}</div>
                                                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>{new Date(act.date).toLocaleString()}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
            )}
        </div>

        <SiteFooter />
        </div>
    );
}