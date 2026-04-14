import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";
import ContentCover from '../ContentCover';

// ==== Constants ====

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

// ==== Helper Functions ====

/**
 * Formats a JavaScript Date object into a local 'YYYY-MM-DD' string.
 * This is crucial for comparing calendar days with the user's submitted study days.
 */
function fmtDateLocal(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Builds a 42-cell array (6 weeks x 7 days) of Date objects to render a consistent calendar grid.
 * It automatically calculates the offset to start the grid on the correct Monday, 
 * filling in the trailing days of the previous month and leading days of the next month.
 */
function buildMonth(year, month) {
    const first = new Date(year, month, 1);
    const start = new Date(first);
    
    // Calculate how many days to step back to reach the previous Monday
    const offset = (first.getDay() + 6) % 7; 
    start.setDate(1 - offset);
    
    const grid = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        grid.push(d);
    }
    return grid;
}

// ==== Main Component ====

/**
 * StudentDashboard Component
 * Displays the main interface for students, including their achievements, 
 * enrolled courses, study calendar, weekly statistics, and test history.
 */
export default function StudentDashboard({ user }) {
    const today = new Date();
    const navigate = useNavigate();

    // Extract user data passed from the parent Profile component with safe fallbacks
    const submittedDays = user?.study?.submittedDays || [];
    const weekStats = user?.weekStats || defaultWeekStats;
    const history = user?.practiceHistory || [];

    // ---- UI State ----
    const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [currentDate, setCurrentDate] = useState(new Date(today));
    const [activeTab, setActiveTab] = useState("Mathematics");

    // ---- Fetched Data State ----
    const [enrolledCourses, setEnrolledCourses] = useState([]);
    const [loadingCourses, setLoadingCourses] = useState(true);
    const [recentBadges, setRecentBadges] = useState([]);

    // Fetch dynamic dashboard data when the component mounts
    useEffect(() => {
        // Fetch the user's enrolled (purchased) courses
        api.get("/courses/enrolled")
            .then(res => setEnrolledCourses(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoadingCourses(false));

        // Fetch user badges, filter out unearned ones, sort by date, and keep only the 4 most recent
        api.get("/badges/my-badges").then(res => {
            const earned = (res.data.badges || [])
                .filter(b => b.isEarned)
                .sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt));
            setRecentBadges(earned.slice(0, 4));
        }).catch(err => console.error(err));
    }, []);

    // ---- Derived State ----
    const monthCells = useMemo(() => buildMonth(month.getFullYear(), month.getMonth()), [month]);
    const minutesTotal = weekStats.reduce((t, r) => t + (r.minutes || 0), 0);
    const displayedHistory = history.filter(h => h.subject === activeTab);

    // ==== Render UI ====

    return (
        <>
        {/* ==== Recent Achievements (Badges) ==== */}
        <div className="role-card" style={{ marginTop: '20px', marginBottom: '20px' }}>
            <div className="role-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-main)' }}>
                    <i className="bi bi-award-fill text-warning" style={{ marginRight: '8px' }}></i> Recent Achievements
                </h3>
                <button className="link-btn" onClick={() => navigate("/badges")}>Badge Case <i className="bi bi-arrow-right"></i></button>
            </div>

            {recentBadges.length === 0 ? (
                <div className="empty" style={{ padding: '20px', textAlign: 'center' }}>
                    <p className="role-muted">No badges yet. Start practicing to unlock them!</p>
                    <button className="ghost-btn" style={{ marginTop: '10px' }} onClick={() => navigate("/tests")}>Start practicing</button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px', marginTop: '16px' }}>
                    {recentBadges.map(badge => (
                        <div key={badge._id} style={{ background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-object) 100%)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '16px', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', cursor: 'pointer' }} onClick={() => navigate("/badges")}>
                            <img src={badge.iconUrl} alt={badge.name} style={{ display: 'block', margin: '0 auto 8px auto', width: '60px', height: '60px', objectFit: 'contain' }} />
                            <h4 style={{ fontSize: '14px', margin: '0 0 4px 0', color: 'var(--text-main)' }}>{badge.name}</h4>
                            <div style={{ fontSize: '11px', color: 'var(--success)' }}>Earned: {new Date(badge.earnedAt).toLocaleDateString()}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* ==== Enrolled Courses ==== */}
        <div className="dash-card" style={{ marginBottom: '16px' }}>
            <div className="card-head">
                <div className="title"><i className="bi bi-journal-check text-success"></i> My Courses</div>
                <button className="link-btn" onClick={() => navigate("/courses")}>Explore more <i className="bi bi-arrow-right"></i></button>
            </div>
            {loadingCourses ? ( <div className="empty" style={{ padding: '20px' }}>Loading your courses...</div> ) : enrolledCourses.length === 0 ? (
                <div className="empty" style={{ padding: '20px' }}><p className="role-muted">You haven't enrolled in any courses yet.</p></div>
            ) : (
                <div className="enrolled-grid">
                    {enrolledCourses.map(enr => (
                        <div key={enr.course._id} className="enrolled-card" onClick={() => navigate(`/courses/${enr.course._id}/learn`)}>
                            <ContentCover 
                                coverUrl={enr.course.coverUrl}
                                title={enr.course.title}
                                subject={enr.course.subject}
                                grade={enr.course.grade}
                                className="ec-thumb"
                            />
                            <div className="ec-info">
                                <h4 className="ec-title">{enr.course.title}</h4>
                                <div className="ec-meta"><span className="chip chip-mini">{(enr.course.subject || "").toUpperCase()}</span><span className="ec-date">Bought: {new Date(enr.enrolledAt).toLocaleDateString()}</span></div>
                            </div>
                            {/* Hover overlay element */}
                            <div className="ec-overlay"><span>Continue Learning <i className="bi bi-play-circle-fill"></i></span></div>
                        </div>
                    ))}
                </div>
            )}
        </div>
        
        {/* ==== Calendar & Stats Grid ==== */}
        <div className="stu-grid">
            
            {/* Left Column: Diligence Calendar */}
            <div className="col-left">
                <div className="dash-card">
                    <div className="card-head">
                        <div className="title">Your diligence calendar</div>
                        <div className="hint"><span className="dot green" /> Submitted</div>
                    </div>
                    {/* Calendar Navigation Controls */}
                    <div className="calendar-bar">
                        <button className="nav" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
                        <div className="month-title">{month.toLocaleString("en-US", { month: "long" })} {month.getFullYear()}</div>
                        <button className="nav" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
                        <button className="go-today" onClick={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setCurrentDate(new Date()); }}>Today</button>
                    </div>
                    {/* Calendar Grid UI */}
                    <div className="calendar-grid">
                        {/* Render Days of the Week Header */}
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (<div key={d} className="dow">{d}</div>))}
                        
                        {/* Render the 42 days grid */}
                        {monthCells.map((d, i) => {
                            // Check if the cell belongs to the currently viewed month (for dimming out-of-month days)
                            const inMonth = d.getMonth() === month.getMonth();
                            const isToday = fmtDateLocal(d) === fmtDateLocal(currentDate);
                            // Check if the user submitted a test on this specific day
                            const submitted = submittedDays.includes(fmtDateLocal(d));
                            
                            const cellClass =  `cal-cell ${inMonth ? "" : "dim"} ${isToday ? "today" : ""} ${submitted ? "submitted" : ""}`
                            return (<div key={i} className={cellClass}><span className={`num ${isToday ? "today" : ""}`}>{d.getDate()}</span></div>);
                        })}
                    </div>
                </div>
            </div>

            {/* Right Column: Weekly Study Stats Table */}
            <div className="col-right">
                <div className="dash-card">
                    <div className="card-head"><div className="title">Weekly study summary</div></div>
                    <div className="table-wrap">
                        <table className="wk-table">
                            <thead>
                                <tr><th>Day</th>{SUBJECTS.map((s) => <th key={s}>{s}</th>)}<th>Study time</th></tr>
                            </thead>
                            <tbody>
                                {weekStats.map((row, i) => (
                                    <tr key={i}>
                                        <td>{row.day}</td>
                                        {/* Dynamically map subjects to avoid hardcoding table columns */}
                                        {SUBJECTS.map((s) => <td key={s}>{row[s] || 0}</td>)}
                                        <td>{Math.floor((row.minutes || 0) / 60)}h {(row.minutes || 0) % 60}m</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td>Total</td>
                                    {/* Calculate column totals vertically */}
                                    {SUBJECTS.map((s) => (<td key={s}>{weekStats.reduce((t, r) => t + (r[s] || 0), 0)}</td>))}
                                    <td>{Math.floor(minutesTotal / 60)}h {minutesTotal % 60}m</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        {/* ==== Practice History ==== */}
        <div className="dash-card mt">
            <div className="card-head"><div className="title">Practice history</div></div>
            {/* Subject Filter Tabs */}
            <div className="tabs">
                {SUBJECTS.map(sub => (
                    <button key={sub} className={`tab ${activeTab === sub ? "active" : ""}`} onClick={() => setActiveTab(sub)}>{sub}</button>
                ))}
            </div>
            
            {/* Conditional Rendering based on filtered history */}
            {displayedHistory.length === 0 ? (
                <div className="empty">
                    <div>You have no practice history for {activeTab} yet.</div>
                    <button className="cta-ghost" style={{marginTop: '10px'}} onClick={() => navigate('/tests')}>Start practicing</button>
                </div>
            ) : (
                <div className="recent-list">
                    {displayedHistory.map(item => (
                        <div key={item.id} className="recent-item">
                            <div className="r-main">
                                <div className="r-title">{item.title}</div>
                                <div className="r-sub">
                                    {/* Color code the score: Green if >= 50%, Red otherwise */}
                                    <span className="chip" style={{ color: item.percent >= 50 ? '#15803d' : '#b91c1c' }}>Score: {item.score}/{item.maxScore} ({item.percent}%)</span>
                                    <span className="chip"><i className="bi bi-clock"></i> {item.timeSpent} mins</span>
                                    <span className="chip"><i className="bi bi-calendar-event"></i> {new Date(item.completedAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="r-actions" style={{ display: 'flex', gap: '8px' }}>
                                <button className="primary-btn" onClick={() => navigate(`/results/${item.id}`)} style={{ padding: '8px 12px', fontSize: '13px' }}><i className="bi bi-eye"></i> View Details</button>
                                <button className="ghost-btn" onClick={() => navigate(`/tests/public/${item.testId}`)}><i className="bi bi-arrow-repeat"></i> Practice Again</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
        </>
    );
}