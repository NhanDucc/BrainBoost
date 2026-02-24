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
 * @param {Number} n - The number to pad.
 * @returns {String} Padded string.
 */
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);

/**
 * Formats a duration in seconds into a HH:MM:SS or MM:SS string.
 * @param {Number|null} s - Total seconds (or null for unlimited).
 * @returns {String} Formatted time string.
 */
function formatSeconds(s) {
    if (s == null) return "Unlimited";
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return hh ? `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}` : `${pad2(mm)}:${pad2(ss)}`;
}

// Labels for multiple choice options
const ABC = ["A", "B", "C", "D"];

/**
 * Main component for taking a test.
 * Handles the timer, answer recording, session persistence, submission, 
 * AI grading for essays, and displaying the results & leaderboard.
 */
export default function TestPlayer() {
    const { id } = useParams();
    const [sp] = useSearchParams();
    const navigate = useNavigate();

    // Extract the time limit (in minutes) from the URL query parameters
    const minutes = useMemo(() => {
        const t = sp.get("time");
        if (!t) return null; // Unlimited
        const m = parseInt(t, 10);
        return Number.isFinite(m) && m > 0 ? m : null;
    }, [sp]);

    // ==== State Management ====
    const [paper, setPaper] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [highlight, setHighlight] = useState(true);   // Toggles UI highlight mode

    /** * Stores the user's current answers.
     * - For MCQ / Boolean: Stores the selected index (number).
     * - For Essay: Stores the typed text (string).
     */
    const [answers, setAnswers] = useState({});
    const [reviewSet, setReviewSet] = useState(() => new Set());    // Set of question IDs marked for review
    const [pi, setPi] = useState(0);    // Current Part Index
    const [qi, setQi] = useState(0);    // Current Question Index

    // Timer states
    const [secondsLeft, setSecondsLeft] = useState(minutes ? minutes * 60 : null);
    const timerRef = useRef(null);
    const startTimeRef = useRef(Date.now());    // Tracks when the user started the test

    // Post-submission states
    const [result, setResult] = useState(null);
    const [showReview, setShowReview] = useState(false);
    const [leaderboard, setLeaderboard] = useState([]);

    // AI Grading states
    const [essayGrades, setEssayGrades] = useState({});
    const [gradingLoading, setGradingLoading] = useState({});
    const [submissionId, setSubmissionId] = useState(null);

    // LocalStorage key for persisting test progress
    const LS_KEY = `test-session:${id}`;

    // ==== Data Fetching & Initialization ====
    useEffect(() => {
        let ignore = false;
        async function load() {
            setLoading(true);
            setError("");
            try {
                // Fetch the test structure from the public API
                const res = await fetch(toAbsolute(`/api/tests/public/${id}`));
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.message || `HTTP ${res.status}`);
                }
                const data = await res.json();

                // Map database schema to the player's required paper shape
                const questions = (data.questions || []).map((q, i) => {
                    const base = {
                        id: q._id ? String(q._id) : `q${i + 1}`,
                        type: q.type || "mcq",
                        stem: q.stem,
                    };

                    if (base.type === "mcq") {
                        return {
                            ...base,
                            choices: q.choices || [],
                            answer: typeof q.correctIndex === "number" ? q.correctIndex : undefined,
                        };
                    }
                    if (base.type === "boolean") {
                        return {
                            ...base,
                            choices: ["True", "False"], // Render as 2 choices
                            answer: typeof q.correctBool === "boolean"
                                ? (q.correctBool ? 0 : 1) // True -> index 0, False -> index 1
                                : undefined,
                        };
                    }
                    // Essay type (Not auto-graded by default)
                    return { ...base, choices: [] };
                });

                const mapped = {
                    title: data.title,
                    subject: data.subject,
                    parts: [{ name: "Part", questions }],
                };

                if (!ignore) {
                    setPaper(mapped);

                    // Restore local session if the user accidentally closed the tab
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
            } catch (e) {
                if (!ignore) setError(e.message || "Failed to load");
            } finally {
                if (!ignore) setLoading(false);
            }
        }
        load();
        return () => { ignore = true; };
        // eslint-disable-next-line
    }, [id]);

    // ==== Timer & Auto-save Logic ====

    // Decrease the timer every second
    useEffect(() => {
        if (secondsLeft == null || secondsLeft <= 0) return;
        timerRef.current = setInterval(
            () => setSecondsLeft((s) => (s == null ? null : s - 1)),
            1000
        );
        return () => clearInterval(timerRef.current);
    }, [secondsLeft]);

    // Automatically submit the test when the time is up
    useEffect(() => {
        if (secondsLeft === 0) handleSubmit(true);
        // eslint-disable-next-line
    }, [secondsLeft]);

    // Persist progress to LocalStorage whenever answers or positions change
    useEffect(() => {
        if (result) return; // Stop persisting after the test is submitted
        const payload = {
            answers,
            reviewIds: Array.from(reviewSet),
            pointer: { pi, qi },
            secondsLeft,
        };
        localStorage.setItem(LS_KEY, JSON.stringify(payload));
    }, [answers, reviewSet, pi, qi, secondsLeft, result]);

    // ==== Navigation & Interaction Helpers ====

    const flatQuestions = useMemo(() => {
        if (!paper) return [];
        return paper.parts.flatMap((p) => p.questions.map((q) => ({ ...q })));
    }, [paper]);

    const total = flatQuestions.length;

    const gotoIndex = (idx) => {
        if (!paper) return;
        let acc = 0;
        for (let i = 0; i < paper.parts.length; i++) {
        const len = paper.parts[i].questions.length;
        if (idx < acc + len) {
            setPi(i);
            setQi(idx - acc);
            return;
        }
        acc += len;
        }
    };

    const globalIndex = useMemo(() => {
        if (!paper) return 0;
        let acc = 0;
        for (let i = 0; i < pi; i++) acc += paper.parts[i].questions.length;
        return acc + qi;
    }, [paper, pi, qi]);

    const current = useMemo(() => {
        if (!paper) return null;
        return paper.parts[pi]?.questions?.[qi] ?? null;
    }, [paper, pi, qi]);

    // Set answers
    const setAnswerIndex = (qid, idx) => setAnswers((prev) => ({ ...prev, [qid]: idx }));
    const setEssayText = (qid, text) => setAnswers((prev) => ({ ...prev, [qid]: text }));

    const toggleReview = (qid) =>
        setReviewSet((s) => {
            const ns = new Set(s);
            ns.has(qid) ? ns.delete(qid) : ns.add(qid);
            return ns;
        });

    // ==== AI Grading & Submission Logic ====

    /**
     * Triggers the AI agent to evaluate and grade an essay question.
     * @param {Object} item - The question object from the result.items array.
     */
    const handleGradeEssay = async (item) => {
        const { idx, stem, essayAnswer, modelAnswer } = item; 
        
        setGradingLoading(prev => ({ ...prev, [idx]: true }));
        try {
            // Call AI grading endpoint
            const res = await api.post("/tests/grade-essay", {
                question: stem,
                student_answer: essayAnswer,
                model_answer: modelAnswer || ""
            });
            
            const aiResult = res.data;
            setEssayGrades(prev => ({ ...prev, [idx]: aiResult }));

            // Save the graded result to the database (if the test was already submitted)
            if (submissionId) {
                await api.post("/tests/update-grade", {
                    resultId: submissionId,
                    questionIdx: idx, 
                    aiData: aiResult
                });
            }
        } catch (err) {
            alert("AI Grading failed. Please try again.");
            console.error(err);
        } finally {
            setGradingLoading(prev => ({ ...prev, [idx]: false }));
        }
    };

    /**
     * Compiles the test results, scores the objective questions, 
     * and submits the payload to the backend.
     * @param {Boolean} auto - Indicates if the submission was triggered automatically by the timer.
     */
    const handleSubmit = async (auto = false) => {
        const items = flatQuestions.map((q, i) => {
            const chosen = answers[q.id];

            if (q.type === "essay") {
                return {
                    idx: i + 1,
                    type: q.type,
                    stem: q.stem,
                    modelAnswer: q.modelAnswer,
                    essayAnswer: typeof chosen === "string" ? chosen : "",
                    isCorrect: null,    // Essays are manually or AI-graded later
                };
            }

            // Objective questions (MCQ / Boolean)
            const correct = typeof q.answer === "number" ? q.answer : null;
            const isCorrect = correct != null && chosen === correct;
            
            return {
                idx: i + 1,
                type: q.type,
                stem: q.stem,
                choices: q.choices,
                chosen,
                correct,
                isCorrect,
            };
        });

        // Tally scores
        const gradableItems = items.filter((it) => it.type === "mcq" || it.type === "boolean");
        const correctCount = gradableItems.filter((x) => x.isCorrect).length;
        const gradableTotal = gradableItems.length;

        const attemptedCount =
        Object.keys(answers).filter((qid) => {
            const q = flatQuestions.find((x) => x.id === qid);
            if (!q) return false;
            if (q.type === "essay") return (answers[qid] || "").trim().length > 0;
            return typeof answers[qid] === "number";
        }).length;

        const incorrectCount = gradableItems.filter((x) => x.chosen != null && x.isCorrect === false).length;
        const unansweredCount = total - attemptedCount;
        const percent = gradableTotal ? Math.round((correctCount / gradableTotal) * 100) : 0;

        // Cleanup: Stop timer and clear the local storage session
        clearInterval(timerRef.current);
        localStorage.removeItem(LS_KEY);

        // Calculate Actual Time Spent
        const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const limitSeconds = minutes ? minutes * 60 : Infinity;
        const actualSeconds = Math.min(elapsedSeconds, limitSeconds);   // Cap at max limit if somehow exceeded
        const timeSpentMinutes = Math.ceil(actualSeconds / 60); // Round up to minutes

        setResult({
            correctCount,
            incorrectCount,
            unansweredCount,
            attemptedCount,
            total,
            gradableTotal,
            percent,
            auto,
            items,
        });

        try {
            // Prepare data payload for the server
            const payload = {
                testId: id,
                resultSummary: { correctCount, gradableTotal, percent },
                timeSpent: timeSpentMinutes,
                answers: items.map(it => ({
                    questionId: `q${it.idx}`, 
                    type: it.type,
                    studentAnswer: it.type === 'essay' ? it.essayAnswer : it.chosen,
                    isCorrect: it.isCorrect,
                }))
            };

            const res = await api.post("/tests/submit", payload);
            if (res.data && res.data._id) {
                setSubmissionId(res.data._id); 
                localStorage.removeItem(LS_KEY); 
            }

            // Fetch the leaderboard immediately after successful submission
            const lbRes = await api.get(`/tests/public/${id}/leaderboard`);
            setLeaderboard(lbRes.data);
            
        } catch (err) {
            console.error("Failed to save result to DB or fetch leaderboard", err);
        }

        try {
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch {}
    };

    /**
     * Resets the test state allowing the user to take it again.
     */
    const retry = () => {
        setAnswers({});
        setReviewSet(new Set());
        setPi(0);
        setQi(0);
        setResult(null);
        setShowReview(false); // Hide the detailed review section when retrying
        setSecondsLeft(minutes ? minutes * 60 : null);
        startTimeRef.current = Date.now(); // Reset the timestamp for the new attempt
    };

    // Determine if a question in the palette has been answered
    const isAnswered = (q) => {
        const v = answers[q.id];
        if (q.type === "essay") return typeof v === "string" && v.trim().length > 0;
        return typeof v === "number";
    };

    return (
        <div className="testplayer-page">
        <SiteHeader />

        <div className="tp-container">
            {loading && <p>Loading test…</p>}
            {!loading && error && <p>{error}</p>}
            {!loading && !error && !paper && <p>Test not found.</p>}

            {/* ===== RESULTS VIEW ===== */}
            {!loading && !error && paper && result && (
            <div className="tp-result-modern">
                <div className="res-hero">
                    <h2 className="res-hero-title">Test Completed!</h2>
                    <p className="res-hero-subtitle">{paper.title}</p>
                    
                    {/* Circle Score Display */}
                    <div className="res-circle-wrap">
                        <div className="res-circle">
                            <span className="res-score-big">{result.correctCount}</span>
                            <span className="res-score-slash">/</span>
                            <span className="res-score-max">{result.gradableTotal}</span>
                        </div>
                        <div className="res-percent">{result.percent}% Accuracy</div>
                    </div>

                    {/* Statistics Badges */}
                    <div className="res-stats-badges">
                        <span className="res-badge success"><i className="bi bi-check-circle-fill"></i> {result.correctCount} Correct</span>
                        <span className="res-badge danger"><i className="bi bi-x-circle-fill"></i> {result.incorrectCount} Incorrect</span>
                        <span className="res-badge warning"><i className="bi bi-dash-circle-fill"></i> {result.unansweredCount} Unanswered</span>
                    </div>

                    {/* Action Buttons */}
                    <div className="res-main-actions">
                        <button className="ghost-btn" onClick={() => navigate("/tests")}>
                            <i className="bi bi-arrow-left"></i> Back to Tests
                        </button>
                        <button className="primary-btn" onClick={retry}>
                            <i className="bi bi-arrow-repeat"></i> Retry Test
                        </button>
                        <button className="secondary-btn" onClick={() => setShowReview(!showReview)}>
                            {showReview ? "Hide Details" : "View Detailed Answers"} <i className={`bi bi-chevron-${showReview ? 'up' : 'down'}`}></i>
                        </button>
                    </div>
                </div>

                <div className="res-bottom-grid">
                    {/* LEADERBOARD SECTION */}
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
                                        // --- LOGIC ẨN DANH (PRIVACY LOGIC) ---
                                        // Lấy cờ ẩn danh từ data trả về
                                        const isAnon = lbEntry.isAnonymous || lbEntry.preferences?.isAnonymous;
                                        // Ghi đè Tên và Avatar nếu đang bật ẩn danh
                                        const displayName = isAnon ? "Anonymous Student" : lbEntry.user;
                                        const displayAvatar = isAnon ? defaultAvatar : (lbEntry.avatar || defaultAvatar);

                                        return (
                                            <tr key={idx} className={idx < 3 ? `top-${idx+1}` : ''}>
                                                <td className="lb-rank">
                                                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                                                </td>
                                                <td className="lb-user">
                                                    <img 
                                                        src={displayAvatar} 
                                                        alt={`${displayName}'s avatar`} 
                                                        onError={(e) => {
                                                            e.target.onerror = null; 
                                                            e.target.src = defaultAvatar;
                                                        }}
                                                    />
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

                    {/* DETAILED ANSWER REVIEW (Hidden by default, toggled via button) */}
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
                                                        <button 
                                                            className={`ai-grade-btn ${gradingLoading[it.idx] ? 'loading' : ''}`}
                                                            onClick={() => handleGradeEssay(it)}
                                                            disabled={gradingLoading[it.idx]}
                                                        >
                                                            {gradingLoading[it.idx] ? (
                                                                <>
                                                                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                                                    AI is analyzing...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <i className="bi bi-stars"></i> Grade with AI
                                                                </>
                                                            )}
                                                        </button>
                                                    ) : (
                                                        <div className="ai-result-box">
                                                            <div className="ai-result-header">
                                                                <div className="ai-title">
                                                                    <i className="bi bi-robot"></i> AI Assessment
                                                                </div>
                                                                <span 
                                                                    className={`ai-score-badge ${
                                                                        essayGrades[it.idx].score >= 8 ? 'ai-score-high' : 
                                                                        essayGrades[it.idx].score >= 5 ? 'ai-score-med' : 'ai-score-low'
                                                                    }`}
                                                                >
                                                                    Score: {essayGrades[it.idx].score}/10
                                                                </span>
                                                            </div>
                                                            
                                                            <div className="ai-feedback">
                                                                <strong>Feedback: </strong> 
                                                                {essayGrades[it.idx].feedback}
                                                            </div>
                                                            
                                                            {essayGrades[it.idx].suggestion && (
                                                                <div className="ai-suggestion">
                                                                    <i className="bi bi-lightbulb-fill"></i>
                                                                    <div>
                                                                        <strong>Suggestion: </strong>
                                                                        {essayGrades[it.idx].suggestion}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        /* Objective Choices UI */
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

            {/* ===== PLAYER VIEW (Displayed while the user is actively taking the test) ===== */}
            {!loading && !error && paper && !result && (
            <>
                {/* Top Header & Controls */}
                <div className="tp-header">
                <h2 className="tp-title">{paper.title}</h2>

                <div className="tp-controls">
                    <label className="switch">
                    <input
                        type="checkbox"
                        checked={highlight}
                        onChange={(e) => setHighlight(e.target.checked)}
                    />
                    <span>Highlight content</span>
                    </label>

                    <div className="timer">
                    Time remaining: <strong>{formatSeconds(secondsLeft)}</strong>
                    </div>

                    <button className="primary-btn" onClick={() => handleSubmit(false)}>
                    Submit
                    </button>
                </div>
                </div>

                <div className="tp-body">
                {/* Left Area: Main Question Content */}
                <div className={`tp-content ${highlight ? "highlight-on" : ""}`}>
                    <div className="tp-part-name">{paper.parts[pi].name}</div>

                    <div className="tp-question">
                    <div className="tp-qhead">
                        <span className="tp-qno">
                        Question {globalIndex + 1} / {total}
                        </span>
                        {current && (
                        <button
                            className={`mark-btn ${
                            reviewSet.has(current.id) ? "marked" : ""
                            }`}
                            onClick={() => toggleReview(current.id)}
                        >
                            {reviewSet.has(current.id) ? "★ Marked" : "☆ Mark for review"}
                        </button>
                        )}
                    </div>

                    {current && (
                        <>
                        {/* Render the question stem */}
                        <div className="tp-stem">
                            <FormulaDisplay content={current.stem} />
                        </div>

                        {/* Multiple Choice Question Input */}
                        {current.type === "mcq" && (
                            <ul className="tp-choices">
                            {current.choices.map((c, idx) => {
                                const chosen = answers[current.id] === idx;
                                return (
                                <li key={idx}>
                                    <label className={`choice ${chosen ? "chosen" : ""}`}>
                                    <input
                                        type="radio"
                                        name={`q-${current.id}`}
                                        checked={chosen}
                                        onChange={() => setAnswerIndex(current.id, idx)}
                                    />
                                    <span className="choice-index">
                                        {String.fromCharCode(65 + idx)}.
                                    </span>
                                    <span className="choice-text">
                                        <FormulaDisplay content={c} />
                                    </span>
                                    </label>
                                </li>
                                );
                            })}
                            </ul>
                        )}

                        {/* True / False Question Input */}
                        {current.type === "boolean" && (
                            <div className="tf-row">
                            {[0, 1].map((idx) => (
                                <label key={idx} className="chip-radio">
                                <input
                                    type="radio"
                                    name={`q-${current.id}`}
                                    checked={answers[current.id] === idx}
                                    onChange={() => setAnswerIndex(current.id, idx)}
                                />
                                <span>{idx === 0 ? "True" : "False"}</span>
                                </label>
                            ))}
                            </div>
                        )}

                        {/* Essay Text Area Input */}
                        {current.type === "essay" && (
                            <div className="essay-box">
                            <textarea
                                rows={6}
                                placeholder="Write your answer here…"
                                value={typeof answers[current.id] === "string" ? answers[current.id] : ""}
                                onChange={(e) => setEssayText(current.id, e.target.value)}
                            />
                            <div className="essay-note">
                                This question will not be auto-graded.
                            </div>
                            </div>
                        )}
                        </>
                    )}
                    </div>

                    {/* Navigation Buttons */}
                    <div className="tp-nav">
                    <button
                        className="ghost-btn"
                        disabled={globalIndex === 0}
                        onClick={() => gotoIndex(globalIndex - 1)}
                    >
                        ← Previous
                    </button>
                    <button
                        className="ghost-btn"
                        disabled={globalIndex === total - 1}
                        onClick={() => gotoIndex(globalIndex + 1)}
                    >
                        Next →
                    </button>
                    </div>
                </div>

                {/* Right Area: Navigation Palette */}
                <aside className="tp-sidebar">
                    <div className="tp-palette-title">Part</div>
                    <div className="tp-palette">
                    {flatQuestions.map((q, idx) => {
                        const answered = isAnswered(q);
                        const marked = reviewSet.has(q.id);
                        const active = idx === globalIndex;
                        return (
                        <button
                            key={q.id}
                            className={[
                            "pal-btn",
                            active ? "active" : "",
                            answered ? "answered" : "",
                            marked ? "marked" : "",
                            ].join(" ")}
                            onClick={() => gotoIndex(idx)}
                        >
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