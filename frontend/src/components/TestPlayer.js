import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { toAbsolute } from "../utils/url";
import { api } from "../api";
import FormulaDisplay from "./FormulaDisplay";
import defaultAvatar from "../images/defaultAvatar.png";
import "../css/TestPlayer.css";

// ==== Utility Functions ====

/**
 * Pads a number with a leading zero if it's less than 10.
 * Used for formatting the countdown timer.
 */
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);

/**
 * Formats a duration in seconds into a HH:MM:SS or MM:SS string.
 * @param {Number|null} s - Remaining seconds. Null means unlimited time.
 */
function formatSeconds(s) {
    if (s == null) return "Unlimited";
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return hh ? `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}` : `${pad2(mm)}:${pad2(ss)}`;
}

// Labels used for rendering Multiple Choice Question choices
const ABC = ["A", "B", "C", "D"];

// ==== Main Component ====

/**
 * TestPlayer Component
 * The core exam-taking interface. Handles fetching test data, managing user progress,
 * auto-saving to local storage, countdown timers, AI grading, and displaying results.
 */
export default function TestPlayer() {
    // ---- Routing & Parameters ----
    const { id } = useParams(); // The ID of the test being taken
    const [sp] = useSearchParams();
    const navigate = useNavigate();

    // Extract and parse the time limit from the URL query parameters
    const minutes = useMemo(() => {
        const t = sp.get("time");
        if (!t) return null; 
        const m = parseInt(t, 10);
        return Number.isFinite(m) && m > 0 ? m : null;
    }, [sp]);

    // ---- Test Data & UI States ----
    const [paper, setPaper] = useState(null);       // The structured test content
    const [loading, setLoading] = useState(true);   // Controls the skeleton loader
    const [error, setError] = useState("");

    // ---- User Progress States ----
    const [answers, setAnswers] = useState({});     // Maps question IDs to user's answers
    const [reviewSet, setReviewSet] = useState(() => new Set()); // Tracks questions flagged for review
    const [pi, setPi] = useState(0);    // Current Part Index (for multi-part tests)
    const [qi, setQi] = useState(0);    // Current Question Index within the part

    // ---- Timer States ----
    const [secondsLeft, setSecondsLeft] = useState(minutes ? minutes * 60 : null);
    const timerRef = useRef(null);               // Reference to the interval timer
    const startTimeRef = useRef(Date.now());     // Records when the test started for duration tracking

    // ---- Post-Submission States ----
    const [result, setResult] = useState(null);  // Holds the calculated score and summary
    const [showReview, setShowReview] = useState(false); // Toggles the detailed answer review UI
    const [leaderboard, setLeaderboard] = useState([]);  // Top performers data

    // ---- AI Grading States ----
    const [essayGrades, setEssayGrades] = useState({});   // Caches AI feedback for essays
    const [gradingLoading, setGradingLoading] = useState({}); // Tracks loading state per essay question
    const [submissionId, setSubmissionId] = useState(null); // The DB ID of the saved result

    // Key used to save the student's live progress in the browser
    const LS_KEY = `test-session:${id}`;

    // ==== Data Fetching & Caching (Stale-While-Revalidate) ====
    
    useEffect(() => {
        let ignore = false; // Flag to prevent memory leaks if component unmounts
        
        /**
         * Helper function to map raw API data to the player's required format.
         * Also restores any previously saved progress from LocalStorage.
         */
        const processTestData = (data) => {
            const questions = (data.questions || []).map((q, i) => {
                const base = { id: q._id ? String(q._id) : `q${i + 1}`, type: q.type || "mcq", stem: q.stem };
                if (base.type === "mcq") {
                    return { ...base, choices: q.choices || [], answer: typeof q.correctIndex === "number" ? q.correctIndex : undefined };
                }
                if (base.type === "boolean") {
                    return { ...base, choices: ["True", "False"], answer: typeof q.correctBool === "boolean" ? (q.correctBool ? 0 : 1) : undefined };
                }
                if (base.type === "short_answer") {
                    return { ...base, choices: [], answer: q.modelAnswer || "" };
                }
                return { ...base, choices: [], modelAnswer: q.modelAnswer || "" };
            });

            // Restructure into parts (currently defaults to 1 part for simplicity)
            const mapped = { title: data.title, subject: data.subject, parts: [{ name: "Part", questions }] };

            if (!ignore) {
                setPaper(mapped);
                
                // ---- LocalStorage Restoration ----
                // Restores the student's dynamic progress (Answers, Pointer, Timer) 
                // so they can refresh the page without losing their work.
                const raw = localStorage.getItem(LS_KEY);
                if (raw) {
                    const saved = JSON.parse(raw);
                    setAnswers(saved.answers || {});
                    setReviewSet(new Set(saved.reviewIds || []));
                    if (saved.pointer) {
                        setPi(saved.pointer.pi ?? 0);
                        setQi(saved.pointer.qi ?? 0);
                    }
                    if (minutes && typeof saved.secondsLeft === "number") {
                        setSecondsLeft(saved.secondsLeft);
                    }
                }
            }
        };

        async function load() {
            setError("");
            
            // Note: We use sessionStorage for the static test content, 
            // but localStorage for the dynamic student progress.
            const cacheKey = `test_content_v1_${id}`;
            const cached = sessionStorage.getItem(cacheKey);

            // 1. Cache-First: If static content is cached, render immediately
            if (cached) {
                processTestData(JSON.parse(cached));
                setLoading(false);
            } else {
                setLoading(true);
            }

            try {
                // 2. Fetch fresh data from the server to ensure accuracy
                const res = await fetch(toAbsolute(`/api/tests/public/${id}`));
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.message || `HTTP ${res.status}`);
                }
                const data = await res.json();
                
                // Cache the newly fetched static content
                sessionStorage.setItem(cacheKey, JSON.stringify(data));

                // 3. Only process and update state if cache wasn't used earlier
                if (!cached && !ignore) {
                    processTestData(data);
                    setLoading(false);
                }
            } catch (e) {
                if (!ignore && !cached) {
                    setError(e.message || "Failed to load test data");
                    setLoading(false);
                }
            }
        }
        
        load();
        return () => { ignore = true; };
        // eslint-disable-next-line
    }, [id]);

    // ==== Timer & Auto-save Logic ====

    // Handle countdown timer ticking
    useEffect(() => {
        if (secondsLeft == null || secondsLeft <= 0) return;
        timerRef.current = setInterval(
            () => setSecondsLeft((s) => (s == null ? null : s - 1)),
            1000
        );
        return () => clearInterval(timerRef.current);
    }, [secondsLeft]);

    // Auto-submit the test when time runs out
    useEffect(() => {
        if (secondsLeft === 0) handleSubmit(true); // pass true to indicate auto-submission
        // eslint-disable-next-line
    }, [secondsLeft]);

    // Auto-save user progress to LocalStorage whenever they interact with the test
    useEffect(() => {
        if (result) return; // Do not save progress if the test is already submitted
        const payload = { answers, reviewIds: Array.from(reviewSet), pointer: { pi, qi }, secondsLeft };
        localStorage.setItem(LS_KEY, JSON.stringify(payload));
    }, [answers, reviewSet, pi, qi, secondsLeft, result]);

    // ==== Navigation & Interaction Helpers ====

    // Flattens the nested parts/questions structure into a single array for easier indexing
    const flatQuestions = useMemo(() => {
        if (!paper) return [];
        return paper.parts.flatMap((p) => p.questions.map((q) => ({ ...q })));
    }, [paper]);

    const total = flatQuestions.length;

    // Navigates to a specific question based on its absolute index
    const gotoIndex = (idx) => {
        if (!paper) return;
        let acc = 0;
        for (let i = 0; i < paper.parts.length; i++) {
            const len = paper.parts[i].questions.length;
            if (idx < acc + len) {
                setPi(i); setQi(idx - acc); return;
            }
            acc += len;
        }
    };

    // Calculates the absolute index of the currently viewed question
    const globalIndex = useMemo(() => {
        if (!paper) return 0;
        let acc = 0;
        for (let i = 0; i < pi; i++) acc += paper.parts[i].questions.length;
        return acc + qi;
    }, [paper, pi, qi]);

    // The actual question object currently being displayed
    const current = useMemo(() => {
        if (!paper) return null;
        return paper.parts[pi]?.questions?.[qi] ?? null;
    }, [paper, pi, qi]);

    // State updaters for different question types
    const setAnswerIndex = (qid, idx) => setAnswers((prev) => ({ ...prev, [qid]: idx }));
    const setEssayText = (qid, text) => setAnswers((prev) => ({ ...prev, [qid]: text }));

    // Checks if a question has been answered (used for UI highlighting in the sidebar palette)
    const isAnswered = (q) => {
        const v = answers[q.id];
        if (q.type === "essay" || q.type === "short_answer") return typeof v === "string" && v.trim().length > 0;
        return typeof v === "number";
    };

    // ==== AI Grading & Submission Logic ====

    /**
     * Triggers the AI microservice to grade a specific essay question.
     */
    const handleGradeEssay = async (item) => {
        const { idx, stem, essayAnswer, modelAnswer } = item; 
        setGradingLoading(prev => ({ ...prev, [idx]: true }));
        try {
            const res = await api.post("/tests/grade-essay", {
                question: stem, student_answer: essayAnswer, model_answer: modelAnswer || ""
            });
            const aiResult = res.data;
            setEssayGrades(prev => ({ ...prev, [idx]: aiResult })); // Cache result locally

            // If the test is already saved to the DB, patch the result document with the new grade
            if (submissionId) {
                await api.post("/tests/update-grade", { resultId: submissionId, questionIdx: idx, aiData: aiResult });
                window.dispatchEvent(new Event("new_notification")); // Trigger navbar bell icon
            }
        } catch (err) {
            alert("AI Grading failed. Please try again.");
            console.error(err);
        } finally {
            setGradingLoading(prev => ({ ...prev, [idx]: false }));
        }
    };

    /**
     * Grades objective questions, aggregates scores, and submits the payload to the backend.
     * @param {Boolean} auto - True if submitted automatically due to timeout.
     */
    const handleSubmit = async (auto = false) => {
        // Step 1: Grade all questions locally before sending to server
        const items = flatQuestions.map((q, i) => {
            const chosen = answers[q.id];
            
            // Essays are not auto-graded here
            if (q.type === "essay") {
                return { idx: i + 1, type: q.type, stem: q.stem, modelAnswer: q.modelAnswer, essayAnswer: typeof chosen === "string" ? chosen : "", isCorrect: null };
            }
            
            let isCorrect = false;
            let correct = null;
            
            // Short Answer requires exact string matching (case-insensitive)
            if (q.type === "short_answer") {
                correct = q.answer; 
                const studentText = (typeof chosen === "string" ? chosen : "").trim().toLowerCase();
                const correctText = (correct || "").trim().toLowerCase();
                isCorrect = studentText.length > 0 && studentText === correctText;
            } else {
                // MCQ and Boolean rely on index matching
                correct = typeof q.answer === "number" ? q.answer : null;
                isCorrect = correct != null && chosen === correct;
            }
            return { idx: i + 1, type: q.type, stem: q.stem, choices: q.choices, chosen: chosen !== undefined ? chosen : null, correct, isCorrect };
        });

        // Step 2: Calculate statistics
        const gradableItems = items.filter((it) => ["mcq", "boolean", "short_answer"].includes(it.type));
        const correctCount = gradableItems.filter((x) => x.isCorrect).length;
        const gradableTotal = gradableItems.length;
        const attemptedCount = Object.keys(answers).filter((qid) => {
            const q = flatQuestions.find((x) => x.id === qid);
            if (!q) return false;
            if (q.type === "essay") return (answers[qid] || "").trim().length > 0;
            return typeof answers[qid] === "number";
        }).length;
        const incorrectCount = gradableItems.filter((x) => x.chosen != null && x.isCorrect === false).length;
        const unansweredCount = total - attemptedCount;
        const percent = gradableTotal ? Math.round((correctCount / gradableTotal) * 100) : 0;

        // Step 3: Stop timer and clear browser cache
        clearInterval(timerRef.current);
        localStorage.removeItem(LS_KEY);

        // Step 4: Calculate actual time spent
        const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const limitSeconds = minutes ? minutes * 60 : Infinity;
        const actualSeconds = Math.min(elapsedSeconds, limitSeconds);  
        const timeSpentMinutes = Math.ceil(actualSeconds / 60);

        // Display results on screen immediately
        setResult({ correctCount, incorrectCount, unansweredCount, attemptedCount, total, gradableTotal, percent, auto, items });

        // Step 5: Save to Database
        try {
            const payload = {
                testId: id,
                resultSummary: { correctCount, gradableTotal, percent },
                timeSpent: timeSpentMinutes,
                answers: items.map(it => ({ questionId: `q${it.idx}`, type: it.type, studentAnswer: it.type === 'essay' ? it.essayAnswer : it.chosen, isCorrect: it.isCorrect }))
            };

            const res = await api.post("/tests/submit", payload);
            if (res.data && res.data._id) {
                setSubmissionId(res.data._id); 
                localStorage.removeItem(LS_KEY);
                navigate(`/results/${res.data._id}`);
            }

            // Fetch updated leaderboard
            const lbRes = await api.get(`/tests/public/${id}/leaderboard`);
            setLeaderboard(lbRes.data);
        } catch (err) {
            console.error("Failed to save result to DB or fetch leaderboard", err);
        }
        try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {}
    };

    /**
     * Resets all states to allow the user to retake the test.
     */
    const retry = () => {
        setAnswers({}); setReviewSet(new Set()); setPi(0); setQi(0);
        setResult(null); setShowReview(false); 
        setSecondsLeft(minutes ? minutes * 60 : null);
        startTimeRef.current = Date.now(); 
    };

    // ==== Loading Skeleton ====

    /**
     * Skeleton UI that mimics the layout of the Test Player.
     * Prevents visual jumping (Cumulative Layout Shift) when data arrives.
     */
    const SkeletonPlayer = () => (
        <>
            <div className="tp-header skeleton-card" style={{ padding: '1.25rem 1.75rem', marginBottom: '1.5rem', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="skeleton skeleton-text" style={{ width: '250px', height: '24px', margin: 0 }}></div>
                <div className="tp-controls" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="skeleton skeleton-text" style={{ width: '150px', height: '20px', margin: 0 }}></div>
                    <div className="skeleton skeleton-btn" style={{ width: '100px', height: '42px', borderRadius: '999px' }}></div>
                </div>
            </div>
            <div className="tp-body" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1.5rem' }}>
                <div className="tp-content skeleton-card" style={{ padding: '1.75rem', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="skeleton skeleton-text" style={{ width: '80px', height: '24px', borderRadius: '999px', marginBottom: '8px' }}></div>
                    <div className="skeleton skeleton-text" style={{ width: '150px', height: '24px', marginBottom: '16px' }}></div>
                    <div className="skeleton skeleton-text" style={{ width: '100%', height: '80px', borderRadius: '12px', marginBottom: '24px' }}></div>
                    <div className="tp-choices" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="skeleton skeleton-text" style={{ width: '100%', height: '56px', borderRadius: '12px', margin: 0 }}></div>
                        ))}
                    </div>
                </div>
                <aside className="tp-sidebar skeleton-card" style={{ padding: '1.25rem', borderRadius: '20px' }}>
                    <div className="skeleton skeleton-text" style={{ width: '60px', height: '20px', marginBottom: '16px' }}></div>
                    <div className="tp-palette" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(40px, 1fr))', gap: '8px' }}>
                        {[...Array(15)].map((_, i) => (
                            <div key={i} className="skeleton" style={{ width: '100%', aspectRatio: '1', borderRadius: '10px' }}></div>
                        ))}
                    </div>
                </aside>
            </div>
        </>
    );

    // ==== Render ====

    return (
        <div className="testplayer-page">
        <SiteHeader />

        <div className="tp-container">
            {/* Conditional Rendering Logic for Loading, Error, and Not Found states */}
            {loading && !paper && <SkeletonPlayer />}
            {!loading && error && <p>{error}</p>}
            {!loading && !error && !paper && <p>Test not found.</p>}

            {/* ===== Results View (Shown after Submission) ===== */}
            {!loading && !error && paper && result && (
            <div className="tp-result-modern">
                <div className="res-hero">
                    <h2 className="res-hero-title">Test Completed!</h2>
                    <p className="res-hero-subtitle">{paper.title}</p>
                    
                    <div className="res-circle-wrap">
                        <div className="res-circle">
                            <span className="res-score-big">{result.correctCount}</span>
                            <span className="res-score-slash">/</span>
                            <span className="res-score-max">{result.gradableTotal}</span>
                        </div>
                        <div className="res-percent">{result.percent}% Accuracy</div>
                    </div>

                    <div className="res-stats-badges">
                        <span className="res-badge success"><i className="bi bi-check-circle-fill"></i> {result.correctCount} Correct</span>
                        <span className="res-badge danger"><i className="bi bi-x-circle-fill"></i> {result.incorrectCount} Incorrect</span>
                        <span className="res-badge warning"><i className="bi bi-dash-circle-fill"></i> {result.unansweredCount} Unanswered</span>
                    </div>

                    <div className="res-main-actions">
                        <button className="ghost-btn" onClick={() => navigate("/tests")}><i className="bi bi-arrow-left"></i> Back to Tests</button>
                        <button className="primary-btn" onClick={retry}><i className="bi bi-arrow-repeat"></i> Retry Test</button>
                        <button className="secondary-btn" onClick={() => setShowReview(!showReview)}>
                            {showReview ? "Hide Details" : "View Detailed Answers"} <i className={`bi bi-chevron-${showReview ? 'up' : 'down'}`}></i>
                        </button>
                    </div>
                </div>

                <div className="res-bottom-grid">
                    {/* ---- Leaderboard Section ---- */}
                    <div className="res-leaderboard">
                        <h3 className="lb-title"><i className="bi bi-trophy-fill text-warning"></i> Top Performers</h3>
                        {leaderboard.length === 0 ? (
                            <p className="lb-empty">No ranking data yet.</p>
                        ) : (
                            <table className="lb-table">
                                <thead>
                                    <tr>
                                        <th>Rank</th>
                                        <th>Student</th>
                                        <th>Score</th>
                                        <th>Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leaderboard.map((lbEntry, idx) => {
                                        // Handle anonymous user preferences
                                        const isAnon = lbEntry.isAnonymous || lbEntry.preferences?.isAnonymous;
                                        const displayName = isAnon ? "Anonymous Student" : lbEntry.user;
                                        const displayAvatar = isAnon ? defaultAvatar : (lbEntry.avatar || defaultAvatar);
                                        return (
                                            <tr key={idx} className={idx < 3 ? `top-${idx+1}` : ''}>
                                                <td className="lb-rank">
                                                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                                                </td>
                                                <td className="lb-user">
                                                    <img src={displayAvatar} alt="avatar" onError={(e) => { e.target.onerror = null; e.target.src = defaultAvatar; }} />
                                                    <span>{displayName}</span>
                                                </td>
                                                <td className="lb-score">{lbEntry.score}/{lbEntry.maxScore}</td>
                                                <td className="lb-time">{lbEntry.timeSpent}m</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* ---- Detailed Answer Review Section ---- */}
                    {showReview && (
                        <div className="res-detailed-review">
                            <h3 className="rv-title">Detailed Review</h3>
                            <div className="rv-list">
                            {result.items.map((it) => (
                                <div key={it.idx} className="rv-item">
                                    <div className="rv-head">
                                        <span className="rv-idx">Q{it.idx}</span>
                                        <span className={`rv-badge ${it.type === "essay" ? "na" : it.chosen == null ? "na" : it.isCorrect ? "ok" : "bad"}`}>
                                            {it.type === "essay" ? "Essay" : it.chosen == null ? "Unanswered" : it.isCorrect ? "Correct" : "Incorrect"}
                                        </span>
                                    </div>

                                    <div className="rv-stem">
                                        <FormulaDisplay content={it.stem} />
                                    </div>

                                    {/* Essay Grading UI */}
                                    {it.type === "essay" ? (
                                        <div className="rv-essay">
                                            <div className="rv-essay-label">Your answer:</div>
                                            <div className="rv-essay-text">
                                                {(it.essayAnswer || "").trim() || "— (empty) —"}
                                            </div>
                                            
                                            {(it.essayAnswer || "").trim().length > 0 && (
                                                <div style={{ marginTop: '16px' }}>
                                                    {!essayGrades[it.idx] ? (
                                                        <button className={`ai-grade-btn ${gradingLoading[it.idx] ? 'loading' : ''}`} onClick={() => handleGradeEssay(it)} disabled={gradingLoading[it.idx]}>
                                                            {gradingLoading[it.idx] ? (<><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> AI is analyzing...</>) : (<><i className="bi bi-stars"></i> Grade with AI</>)}
                                                        </button>
                                                    ) : (
                                                        <div className="ai-result-box">
                                                            <div className="ai-result-header">
                                                                <div className="ai-title"><i className="bi bi-robot"></i> AI Assessment</div>
                                                                <span className={`ai-score-badge ${essayGrades[it.idx].score >= 8 ? 'ai-score-high' : essayGrades[it.idx].score >= 5 ? 'ai-score-med' : 'ai-score-low'}`}>
                                                                    Score: {essayGrades[it.idx].score}/10
                                                                </span>
                                                            </div>
                                                            <div className="ai-feedback"><strong>Feedback: </strong> {essayGrades[it.idx].feedback}</div>
                                                            {essayGrades[it.idx].suggestion && (
                                                                <div className="ai-suggestion"><i className="bi bi-lightbulb-fill"></i><div><strong>Suggestion: </strong>{essayGrades[it.idx].suggestion}</div></div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : it.type === "short_answer" ? (
                                        /* Short Answer Review UI */
                                        <div className="rv-essay">
                                            <div className="rv-essay-label" style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Your answer:</div>
                                            <div style={{ padding: '12px', background: 'var(--bg-input)', borderRadius: '8px', border: `2px solid ${it.isCorrect ? 'var(--success)' : 'var(--error)'}`, color: 'var(--text-main)', fontSize: '16px', fontWeight: 'bold' }}>
                                                {(typeof it.chosen === 'string' ? it.chosen : "").trim() || "— (empty) —"}
                                            </div>
                                            {!it.isCorrect && (
                                                <div style={{ marginTop: '10px', color: 'var(--success)', fontWeight: 'bold', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <i className="bi bi-check-circle-fill"></i> Correct answer: <span style={{ textDecoration: 'underline' }}>{it.correct}</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* Objective Choices (MCQ/Boolean) Review UI */
                                        <ul className="rv-choices">
                                            {it.choices.map((c, ci) => {
                                                const isCorrect = ci === it.correct;
                                                const isChosen = ci === it.chosen;
                                                return (
                                                <li key={ci} className={["rv-choice", isCorrect ? "correct" : "", isChosen && !isCorrect ? "chosen" : ""].join(" ")}>
                                                    <span className="rv-index">{ABC[ci] ?? (ci === 0 ? "T" : "F")}.</span>
                                                    <span className="rv-text"><FormulaDisplay content={c} /></span>
                                                    {isCorrect && <span className="rv-tag">Correct</span>}
                                                    {isChosen && !isCorrect && <span className="rv-tag wrong">Your choice</span>}
                                                </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>
                            ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            )}

            {/* ===== Player View (Active Testing Interface) ===== */}
            {!loading && !error && paper && !result && (
            <>
                <div className="tp-header">
                <h2 className="tp-title">{paper.title}</h2>
                <div className="tp-controls">
                    <div className="timer">
                    Time remaining: <strong>{formatSeconds(secondsLeft)}</strong>
                    </div>
                    <button className="primary-btn" onClick={() => handleSubmit(false)}>Submit</button>
                </div>
                </div>

                <div className="tp-body">
                {/* ---- Left Area: Main Question Content ---- */}
                <div className={`tp-content`}>
                    <div className="tp-part-name">{paper.parts[pi].name}</div>

                    <div className="tp-question">
                    <div className="tp-qhead">
                        <span className="tp-qno">
                        Question {globalIndex + 1} / {total}
                        </span>
                    </div>

                    {current && (
                        <>
                        <div className="tp-stem"><FormulaDisplay content={current.stem} /></div>

                        {/* MCQ Input UI */}
                        {current.type === "mcq" && (
                            <ul className="tp-choices">
                            {current.choices.map((c, idx) => {
                                const chosen = answers[current.id] === idx;
                                return (
                                <li key={idx}>
                                    <label className={`choice ${chosen ? "chosen" : ""}`}>
                                    <input type="radio" name={`q-${current.id}`} checked={chosen} onChange={() => setAnswerIndex(current.id, idx)} />
                                    <span className="choice-index">{String.fromCharCode(65 + idx)}.</span>
                                    <span className="choice-text"><FormulaDisplay content={c} /></span>
                                    </label>
                                </li>
                                );
                            })}
                            </ul>
                        )}

                        {/* True / False Input UI */}
                        {current.type === "boolean" && (
                            <div className="tf-row">
                            {[0, 1].map((idx) => (
                                <label key={idx} className="chip-radio">
                                <input type="radio" name={`q-${current.id}`} checked={answers[current.id] === idx} onChange={() => setAnswerIndex(current.id, idx)} />
                                <span>{idx === 0 ? "True" : "False"}</span>
                                </label>
                            ))}
                            </div>
                        )}

                        {/* Short Answer Input UI */}
                        {current.type === "short_answer" && (
                            <div className="short-answer-box" style={{ marginTop: '16px' }}>
                                <input type="text" placeholder="Type your short answer here…" value={typeof answers[current.id] === "string" ? answers[current.id] : ""} onChange={(e) => setEssayText(current.id, e.target.value)} style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-input)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '16px', fontWeight: 'bold', outline: 'none' }} />
                            </div>
                        )}
                        
                        {/* Essay Input UI */}
                        {current.type === "essay" && (
                            <div className="essay-box">
                            <textarea placeholder="Write your answer here…" value={typeof answers[current.id] === "string" ? answers[current.id] : ""} onChange={(e) => setEssayText(current.id, e.target.value)} />
                            <div className="essay-note">This question will not be auto-graded.</div>
                            </div>
                        )}
                        </>
                    )}
                    </div>

                    <div className="tp-nav">
                    <button className="ghost-btn" disabled={globalIndex === 0} onClick={() => gotoIndex(globalIndex - 1)}>← Previous</button>
                    <button className="ghost-btn" disabled={globalIndex === total - 1} onClick={() => gotoIndex(globalIndex + 1)}>Next →</button>
                    </div>
                </div>

                {/* ---- Right Area: Navigation Palette ---- */}
                <aside className="tp-sidebar">
                    <div className="tp-palette-title">Part</div>
                    <div className="tp-palette">
                    {flatQuestions.map((q, idx) => {
                        const answered = isAnswered(q);
                        const marked = reviewSet.has(q.id);
                        const active = idx === globalIndex;
                        return (
                        <button key={q.id} className={["pal-btn", active ? "active" : "", answered ? "answered" : "", marked ? "marked" : ""].join(" ")} onClick={() => gotoIndex(idx)}>
                            {idx + 1}
                        </button>
                        );
                    })}
                    </div>
                </aside>
                </div>
            </>
            )}
        </div>
        <SiteFooter />
        </div>
    );
}