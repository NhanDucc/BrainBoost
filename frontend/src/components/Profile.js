import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import "../css/Profile.css";
import defaultAvatar from "../images/defaultAvatar.png";
import { useNavigate } from "react-router-dom";
import { toAbsolute } from "../utils/url";

/* Các môn học hiển thị trên bảng */
const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "English"];

// Hàm chuyển đổi ngày giờ sang chuẩn YYYY-MM-DD theo giờ Local (tránh lỗi múi giờ UTC)
function fmtDateLocal(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function buildMonth(year, month) {
    // return 6x7 grid for mini calendar
    const first = new Date(year, month, 1);
    const start = new Date(first);
    const offset = (first.getDay() + 6) % 7; // Monday-first
    start.setDate(1 - offset);
    const grid = [];
    for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        grid.push(d);
    }
    return grid;
}

// Bảng dữ liệu trống dùng làm mặc định nếu user chưa có dữ liệu tuần này
const defaultWeekStats = [
    { day: "Mon", Mathematics: 0, Physics: 0, Chemistry: 0, English: 0, minutes: 0 },
    { day: "Tue", Mathematics: 0, Physics: 0, Chemistry: 0, English: 0, minutes: 0 },
    { day: "Wed", Mathematics: 0, Physics: 0, Chemistry: 0, English: 0, minutes: 0 },
    { day: "Thu", Mathematics: 0, Physics: 0, Chemistry: 0, English: 0, minutes: 0 },
    { day: "Fri", Mathematics: 0, Physics: 0, Chemistry: 0, English: 0, minutes: 0 },
    { day: "Sat", Mathematics: 0, Physics: 0, Chemistry: 0, English: 0, minutes: 0 },
    { day: "Sun", Mathematics: 0, Physics: 0, Chemistry: 0, English: 0, minutes: 0 },
];

function StudentDashboard({ user }) {
    const today = new Date();
    
    // ĐÃ GỠ BỎ MOCK DATA. SỬ DỤNG DỮ LIỆU THẬT TỪ DATABASE:
    const submittedDays = user?.study?.submittedDays || [];
    const weekStats = user?.weekStats || defaultWeekStats;

    const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [currentDate, setCurrentDate] = useState(new Date(today));
    
    const monthCells = useMemo(() => buildMonth(month.getFullYear(), month.getMonth()), [month]);
    
    // Tính tổng thời gian học trong tuần
    const minutesTotal = weekStats.reduce((t, r) => t + (r.minutes || 0), 0);

    const handleTodayClick = () => {
        const todayObj = new Date();
        setMonth(new Date(todayObj.getFullYear(), todayObj.getMonth(), 1));
        setCurrentDate(todayObj);
    };

    return (
        <>
        {/* TOP GRID */}
        <div className="stu-grid">
            {/* Left column: calendar */}
            <div className="col-left">
                {/* Mini Calendar */}
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
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                            <div key={d} className="dow">{d}</div>
                        ))}
                        {monthCells.map((d, i) => {
                            const inMonth = d.getMonth() === month.getMonth();
                            const isToday = fmtDateLocal(d) === fmtDateLocal(currentDate);
                            // Kiểm tra xem ngày này có trong mảng dữ liệu thật từ Backend không
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

            {/* Right column: weekly table */}
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

        {/* Practice history placeholder */}
        <div className="dash-card mt">
            <div className="card-head"><div className="title">Practice history</div></div>
            <div className="tabs">
                <button className="tab active">Mathematics</button>
                <button className="tab">Physics</button>
                <button className="tab">Chemistry</button>
                <button className="tab">English</button>
            </div>
            <div className="empty">
                <div>You have no practice yet. Pick a subject and start now!</div>
                <button className="cta-ghost">Start practicing</button>
            </div>
        </div>
        </>
    );
}

/* Profile */
export default function Profile() {
    const navigate = useNavigate();
    const [user, setUser] = useState({
        fullname: "Name",
        avatarUrl: "",
        bannerUrl: "",
        role: null,
    });
    const [error] = useState("");

    // Load profile
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
                study: u.study,            // Cập nhật dữ liệu study (chứa submittedDays)
                weekStats: u.weekStats,    // Cập nhật dữ liệu weekStats
            });
        } catch {
            /* ignore */
        }
        })();
    }, []);

    // Computed flags
    const role = user.role || "student";
    const isStudent = role === "student";
    const isInstructor = role === "instructor";
    const isAdmin = role === "admin";

    // Avatar/Banner
    const rawAvatar = user?.avatarUrl || defaultAvatar;
    const avatarSrc = user?.avatarUrl ? rawAvatar : defaultAvatar;
    const bannerSrc = user?.bannerUrl || "https://via.placeholder.com/1200x300?text=Cover+Image";

    const [myTests, setMyTests] = useState([]);
    const [itLoading, setItLoading] = useState(false);

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
        // có thể đặt toast ở đây nếu muốn
        } finally {
        setItLoading(false);
        }
    })();
    }, [user.role]);

    const testsTotal = myTests.length;
    const questionsTotal = myTests.reduce((t, x) => t + (x.numQuestions || (x.questions?.length || 0)), 0);
    const subjectSet = new Set(myTests.map(t => t.subject));
    const recent = myTests.slice(0, 5);

    return (
        <div className="profile-page">
        <SiteHeader />

        <div className="profile-container">
            {/* Cover */}
            <div className="profile-cover">
            <img
                src={bannerSrc}
                alt="Cover"
                className="cover-fake-image"
            />
            </div>

            {/* Avatar + name */}
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

            {/* ====== STUDENT VIEW ====== */}
            {isStudent && (
            <StudentDashboard user={user} />
            )}

            {/* ====== INSTRUCTOR VIEW (placeholder) ====== */}
            {isInstructor && (
            <div className="role-section">
                {/* Quick actions */}
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

                {/* Overview stats */}
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

                {/* Recent tests */}
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

            {/* ====== ADMIN VIEW (placeholder) ====== */}
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