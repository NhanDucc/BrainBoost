import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toAbsolute } from "../../utils/url";

export default function InstructorOverview() {
    const navigate = useNavigate();

    // ==== State Management ====
    const [myTests, setMyTests] = useState([]);
    const [myCourses, setMyCourses] = useState([]);
    const [itLoading, setItLoading] = useState(true);

    // ==== Data Fetching ====

    useEffect(() => {
        // Use Promise.all to fetch both tests and courses concurrently for better performance
        Promise.all([
            fetch(toAbsolute("/api/tests?mine=1"), { credentials: "include" }).then(r => r.json()).catch(() => []),
            fetch(toAbsolute("/api/courses?mine=1"), { credentials: "include" }).then(r => r.json()).catch(() => [])
        ]).then(([testsData, coursesData]) => {
            // Safely extract the data array from the response, handling different possible response structures
            setMyTests(Array.isArray(testsData?.data) ? testsData.data : (Array.isArray(testsData) ? testsData : []));
            setMyCourses(Array.isArray(coursesData?.data) ? coursesData.data : (Array.isArray(coursesData) ? coursesData : []));
            
            // Turn off the loading state once both requests are complete
            setItLoading(false);
        });
    }, []);

    // ==== Derived Statistics (KPIs) ====

    // Calculate total counts based on the fetched data arrays
    const testsTotal = myTests.length;
    const coursesTotal = myCourses.length;
    
    // Sum up the total number of questions across all tests created by the instructor
    const questionsTotal = myTests.reduce((t, x) => t + (x.numQuestions || (x.questions?.length || 0)), 0);
    
    // Sum up the total number of times students have attempted this instructor's tests
    const attemptsTotal = myTests.reduce((t, x) => t + (x.attempts || 0), 0);
    
    // Extract the top 5 most recent tests for the quick view list
    const recent = myTests.slice(0, 5);

    // ==== Render UI ====

    return (
        <div className="role-section">
            
            {/* Quick Actions Section */}
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

            {/* KPI Statistics Cards */}
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

            {/* Recent Tests List Section */}
            <div className="role-card">
                <div className="role-card-head">
                    <h4>Recent tests</h4>
                    <button className="link-btn" onClick={() => navigate("/instructor")}>View all</button>
                </div>
                
                {/* Conditional Rendering based on loading state and data availability */}
                {itLoading ? (
                    <div className="empty">Loading…</div>
                ) : recent.length === 0 ? (
                    <div className="empty">You haven’t published any tests yet.</div>
                ) : (
                    <div className="recent-list">
                    {recent.map(t => (
                        <div key={t._id} className="recent-item">
                            <div className="r-main">
                                <div className="r-title">
                                    {t.title}
                                    {/* Highlight the number of student attempts if it's greater than 0 */}
                                    {t.attempts > 0 && <span style={{ fontSize: '12px', marginLeft: '10px', color: 'var(--success)' }}>({t.attempts} attempts)</span>}
                                </div>
                                
                                {/* Metadata chips: Subject, Grade, Question Count */}
                                <div className="r-sub">
                                    <span className="chip">{(t.subject || "").toUpperCase()}</span>
                                    {t.grade && <span className="chip">Grade {t.grade}</span>}
                                    <span className="chip">{t.numQuestions || (t.questions?.length || 0)} Qs</span>
                                </div>
                            </div>
                            
                            {/* Action buttons for each specific test */}
                            <div className="r-actions" style={{ display: 'flex', gap: '8px' }}>
                                <button className="ghost-btn" onClick={() => navigate(`/tests/public/${t._id}/leaderboard`)}>
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
    );
}