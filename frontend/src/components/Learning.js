import { useState, useEffect } from "react";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import FormulaDisplay from "./FormulaDisplay";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import "../css/Learning.css";

// Standard labels for multiple-choice questions
const ABC = ["A", "B", "C", "D"];

/**
 * Learning Component
 * Serves as the user's personal "Learning Space".
 * Contains tabs for tracking mistakes, saved tests (bookmarks), and AI-generated learning paths.
 */
export default function Learning() {
    const navigate = useNavigate();

    // ==== State Management ====

    const [activeTab, setActiveTab] = useState("mistakes");
    const [mistakes, setMistakes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [bookmarks, setBookmarks] = useState([]);
    const [learningPaths, setLearningPaths] = useState([]);
    
    // ==== Side Effects & Data Fetching ====

    // Triggers the appropriate data fetch whenever the user switches tabs
    useEffect(() => {
        if (activeTab === "mistakes") {
            fetchMistakes();
        } else if (activeTab === "bookmarks") {
            fetchBookmarks();
        } else if (activeTab === "path") {
            fetchPaths();
        }
    }, [activeTab]);

    // Fetches the user's incorrectly answered questions across all completed tests
    const fetchMistakes = async () => {
        setLoading(true);
        try {
            const res = await api.get("/learning/mistakes");
            setMistakes(res.data || []);
        } catch (error) {
            console.error("Failed to load mistakes notebook", error);
        } finally {
            setLoading(false);
        }
    };

    // Fetches the list of tests the user has saved/bookmarked for later
    const fetchBookmarks = async () => {
        setLoading(true);
        try {
            const res = await api.get("/learning/bookmarks");
            setBookmarks(res.data || []);
        } catch (error) {
            console.error("Failed to load bookmarks", error);
        } finally {
            setLoading(false);
        }
    };

    // Fetches the AI-generated learning paths the user has saved from the homepage
    const fetchPaths = async () => {
        setLoading(true);
        try {
            const res = await api.get("/learning/paths");
            setLearningPaths(res.data || []);
        } catch (error) {
            console.error("Failed to load learning paths", error);
        } finally {
            setLoading(false);
        }
    };

    // ==== Event Handlers ====

    /**
     * Removes a test from the user's bookmarks directly from the Learning page.
     * Optimistically updates the UI to remove the card immediately.
     * @param {String} testId - The ID of the test to unsave.
     */
    const handleRemoveBookmark = async (testId) => {
        try {
            await api.post("/learning/bookmarks/toggle", { testId });
            // Cập nhật lại UI lập tức
            setBookmarks(prev => prev.filter(b => b.id !== testId));
        } catch (error) {
            console.error("Failed to remove bookmark");
        }
    };

    return (
        <div className="learning-page">
        <SiteHeader />
        
        <div className="learning-container">
            <div className="learning-header">
            <h1 className="learning-title">My Learning Space</h1>
            <p className="learning-subtitle">Track your progress, review mistakes, and master your subjects.</p>
            </div>

            <div className="learning-layout">
            {/* ==== Sidebar Navigation ==== */}
            <aside className="learning-sidebar">
                <button 
                    className={`l-nav-item ${activeTab === 'mistakes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('mistakes')}
                >
                    <i className="bi bi-journal-x"></i> Mistakes Notebook
                </button>
                <button 
                    className={`l-nav-item ${activeTab === 'bookmarks' ? 'active' : ''}`}
                    onClick={() => setActiveTab('bookmarks')}
                >
                    <i className="bi bi-bookmark-star"></i> Saved Tests
                </button>
                <button 
                    className={`l-nav-item ${activeTab === 'path' ? 'active' : ''}`}
                    onClick={() => setActiveTab('path')}
                >
                    <i className="bi bi-signpost-split"></i> Learning Path
                </button>
            </aside>

            {/* ==== Main Content Area ==== */}
            <main className="learning-content">
                
                {/* ---- Tab 1: Mistakes Notebook ---- */}
                {activeTab === 'mistakes' && (
                <div className="l-section">
                    <h2>Mistakes Notebook</h2>
                    <p className="l-desc">Questions you answered incorrectly are automatically saved here for review.</p>
                    
                    {loading ? (
                    <div className="l-empty-state"><p>Loading your notebook...</p></div>
                    ) : mistakes.length === 0 ? (
                        <div className="l-empty-state">
                            <i className="bi bi-check2-circle text-success"></i>
                            <p>Great job! You have no recorded mistakes right now.</p>
                        </div>
                    ) : (
                    <div className="mistake-list">
                        {mistakes.map((m, index) => (
                        <div key={m.id} className="mistake-card">
                            {/* Card Header: Subject, Test Title, and Date */}
                            <div className="m-card-header">
                                <span className={`chip chip-${(m.subject || "").toLowerCase()}`}>{m.subject}</span>
                                <span className="m-test-title">From: {m.testTitle}</span>
                                <span className="m-date">{new Date(m.completedAt).toLocaleDateString()}</span>
                            </div>

                            {/* Question Stem */}
                            <div className="m-stem">
                                <strong>Question {index + 1}: </strong>
                                <FormulaDisplay content={m.stem} />
                            </div>

                            {/* Multiple Choices: Highlights correct (green) and incorrect student choice (red) */}
                            <div className="m-choices">
                            {m.choices.map((choice, cIdx) => {
                                const isStudentChoice = m.studentAnswer === cIdx;
                                const isCorrectChoice = m.correctAnswer === cIdx;
                                
                                let choiceClass = "m-choice ";
                                if (isCorrectChoice) choiceClass += "is-correct";
                                else if (isStudentChoice) choiceClass += "is-wrong";

                                return (
                                    <div key={cIdx} className={choiceClass}>
                                        <span className="m-choice-idx">{m.type === 'mcq' ? ABC[cIdx] : (cIdx === 0 ? "T" : "F")}.</span>
                                        <div className="m-choice-text"><FormulaDisplay content={choice} /></div>
                                        {isCorrectChoice && <i className="bi bi-check-circle-fill m-icon-correct"></i>}
                                        {isStudentChoice && !isCorrectChoice && <i className="bi bi-x-circle-fill m-icon-wrong"></i>}
                                    </div>
                                );
                            })}
                            </div>

                            {/* Explanation / Solution */}
                            <div className="m-explanation">
                            <strong><i className="bi bi-lightbulb"></i> Explanation:</strong>
                            <div style={{ marginTop: '4px' }}>
                                <FormulaDisplay content={m.explanation} />
                            </div>
                            </div>
                            
                            {/* Action to retake the original test */}
                            <div className="m-actions">
                            <button className="ghost-btn" onClick={() => navigate(`/tests/public/${m.testId}`)}>
                                Retake Test
                            </button>
                            </div>
                        </div>
                        ))}
                    </div>
                    )}
                </div>
                )}

                {/* ---- Tab 2: Saved Tests (Bookmarks) ---- */}
                {activeTab === 'bookmarks' && (
                    <div className="l-section">
                        <h2>Saved Tests</h2>
                        <p className="l-desc">Tests you've bookmarked to practice later.</p>
                        
                        {loading ? (
                            <div className="l-empty-state"><p>Loading your saved tests...</p></div>
                        ) : bookmarks.length === 0 ? (
                            <div className="l-empty-state">
                                <i className="bi bi-bookmark"></i>
                                <p>You haven't saved any tests.</p>
                                <button className="primary-btn" onClick={() => navigate('/tests')}>Explore Tests</button>
                            </div>
                        ) : (
                            <div className="tests-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                                {bookmarks.map((t) => (
                                    <article className="test-card" key={t.id}>
                                        <div className="test-info">
                                            <div className="test-topline" style={{ flexWrap: 'wrap' }}>
                                                <span className={`chip chip-${(t.subjectKey || "").toLowerCase()}`}>{t.subject}</span>
                                                <span className="chip chip-level">{t.difficulty}</span>
                                                {t.grade && <span className="chip chip-grade">Grade {t.grade}</span>}
                                            </div>
                                            <h3 className="test-title">{t.title}</h3>
                                            <p className="test-desc" title={t.description}>{t.description}</p>
                                            <div className="test-meta">
                                                <span className="bi bi-file-earmark-text-fill"> {t.questions} questions</span>
                                            </div>
                                        </div>
                                        <div className="test-actions" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <button className="ghost-btn" style={{ color: '#dc2626', borderColor: '#fecaca' }} onClick={() => handleRemoveBookmark(t.id)}>
                                                <i className="bi bi-bookmark-x"></i> Unsave
                                            </button>
                                            <button className="ghost-btn" onClick={() => navigate(`/tests/public/${t.id}`)}>
                                                Practice
                                            </button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ---- Tab 3: AI Learning Paths ---- */}
                {activeTab === 'path' && (
                    <div className="l-section">
                        <h2>Saved Learning Paths</h2>
                        <p className="l-desc">Your personalized learning journeys recommended by AI.</p>
                        
                        {loading ? (
                            <div className="l-empty-state"><p>Loading your learning paths...</p></div>
                        ) : learningPaths.length === 0 ? (
                            <div className="l-empty-state">
                                <i className="bi bi-robot"></i>
                                <p>You haven't saved any AI learning paths yet.</p>
                                <button className="primary-btn" onClick={() => navigate('/')}>Generate a Path</button>
                            </div>
                        ) : (
                            <div className="saved-paths-list">
                                {learningPaths.map((lp) => (
                                    <div key={lp._id} className="saved-path-card">
                                        <div className="sp-header">
                                            <div className="sp-goal">
                                                <i className="bi bi-geo-alt-fill text-danger"></i> Goal: {lp.goal || "Master my subject"}
                                            </div>
                                            <div className="sp-date">Generated on: {new Date(lp.savedAt).toLocaleDateString()}</div>
                                        </div>
                                        
                                        <div className="sp-advice">
                                            <strong>AI Advice: </strong>{lp.advice}
                                        </div>

                                        <div className="sp-steps">
                                            {lp.path.map((step, idx) => (
                                                <div key={idx} className="sp-step-item">
                                                    <div className="sp-step-num">{idx + 1}</div>
                                                    <div className="sp-step-content">
                                                        <h4>{step.title}</h4>
                                                        <p>{step.reason}</p>
                                                        <span className="sp-chip">{step.subject} • Grade {step.grade}</span>
                                                    </div>
                                                    <button className="ghost-btn" onClick={() => navigate(`/courses/${step.id}`)}>Go</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
            </div>
        </div>

        <SiteFooter />
        </div>
    );
}