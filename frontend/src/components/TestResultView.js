import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { api } from "../api";
import FormulaDisplay from "./FormulaDisplay";
import defaultAvatar from "../images/defaultAvatar.png";
import "../css/TestPlayer.css";

const ABC = ["A", "B", "C", "D"];

export default function TestResultView() {
    const { resultId } = useParams();
    const navigate = useNavigate();

    const [resultData, setResultData] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [gradingLoading, setGradingLoading] = useState({});

    // ==========================================
    // TOAST NOTIFICATION STATE
    // ==========================================
    const [toast, setToast] = useState({ show: false, msg: "", type: "" });

    // Tự động ẩn Toast sau 4 giây
    useEffect(() => {
        if (toast.show) {
            const timer = setTimeout(() => setToast({ show: false, msg: "", type: "" }), 4000);
            return () => clearTimeout(timer);
        }
    }, [toast.show]);

    // Fetch Result Details
    useEffect(() => {
        async function fetchData() {
            try {
                const res = await api.get(`/tests/results/${resultId}`);
                setResultData(res.data);

                if (res.data && res.data.test) {
                    const lbRes = await api.get(`/tests/public/${res.data.test._id}/leaderboard`);
                    setLeaderboard(lbRes.data);
                }
            } catch (err) {
                setError("Failed to load test result. It may not exist or you don't have permission.");
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [resultId]);

    // Gọi Backend chạy ngầm AI (Đã thay thế alert bằng Toast)
    const handleTriggerAIGrading = async (questionIdx) => {
        setGradingLoading(prev => ({ ...prev, [questionIdx]: true }));
        try {
            await api.post("/tests/trigger-ai-grading", {
                resultId: resultId,
                questionIdx: questionIdx
            });
            // Hiển thị Toast Thành công
            setToast({
                show: true,
                msg: "AI grading started! You can safely leave this page. We'll notify you when it's done.",
                type: "success"
            });
        } catch (err) {
            // Hiển thị Toast Lỗi
            setToast({
                show: true,
                msg: "Failed to start AI grading. Please try again.",
                type: "error"
            });
            setGradingLoading(prev => ({ ...prev, [questionIdx]: false }));
        }
    };

    if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Loading result details...</div>;
    if (error) return <div style={{ padding: '50px', textAlign: 'center', color: 'var(--error)' }}>{error}</div>;
    if (!resultData || !resultData.test) return null;

    const { test, answers, totalScore, maxScore, finalPercent } = resultData;

    // ==========================================
    // TÍNH TOÁN 3 CHỈ SỐ ĐÚNG / SAI / BỎ QUA
    // ==========================================
    let correctCount = 0;
    let incorrectCount = 0;
    let attemptedCount = 0;

    answers.forEach(ans => {
        if (ans.type === 'essay') {
            if (ans.studentAnswer && String(ans.studentAnswer).trim().length > 0) {
                attemptedCount++;
            }
        } else {
            // Trắc nghiệm / Đúng sai
            if (ans.studentAnswer != null) {
                attemptedCount++;
                if (ans.isCorrect) correctCount++;
                else incorrectCount++;
            }
        }
    });
    const unansweredCount = test.questions.length - attemptedCount;

    return (
        <div className="testplayer-page">
            <SiteHeader />
            <div className="tp-container">
                <div className="tp-result-modern">
                    {/* HERO SECTION */}
                    <div className="res-hero">
                        <h2 className="res-hero-title">Test Result Details</h2>
                        <p className="res-hero-subtitle">{test.title}</p>
                        
                        <div className="res-circle-wrap">
                            <div className="res-circle">
                                <span className="res-score-big">{totalScore}</span>
                                <span className="res-score-slash">/</span>
                                <span className="res-score-max">{maxScore}</span>
                            </div>
                            <div className="res-percent">{finalPercent}% Accuracy</div>
                        </div>

                        {/* 3 CỤC BADGES ĐÃ ĐƯỢC THÊM LẠI VÀO ĐÂY */}
                        <div className="res-stats-badges">
                            <span className="res-badge success"><i className="bi bi-check-circle-fill"></i> {correctCount} Correct</span>
                            <span className="res-badge danger"><i className="bi bi-x-circle-fill"></i> {incorrectCount} Incorrect</span>
                            <span className="res-badge warning"><i className="bi bi-dash-circle-fill"></i> {unansweredCount} Unanswered</span>
                        </div>

                        <div className="res-main-actions">
                            <button className="ghost-btn" onClick={() => navigate("/profile")}>
                                <i className="bi bi-person-circle"></i> Back to Profile
                            </button>
                            <button className="primary-btn" onClick={() => navigate(`/tests/${test._id}`)}>
                                <i className="bi bi-arrow-repeat"></i> Practice Again
                            </button>
                        </div>
                    </div>

                    <div className="res-bottom-grid">
                        {/* LEADERBOARD */}
                        <div className="res-leaderboard">
                            <h3 className="lb-title"><i className="bi bi-trophy-fill text-warning"></i> Top Performers</h3>
                            {leaderboard.length === 0 ? (
                                <p className="lb-empty" style={{ color: 'var(--text-secondary)' }}>No ranking data yet.</p>
                            ) : (
                                <table className="lb-table">
                                    <thead>
                                        <tr>
                                            <th>Rank</th>
                                            <th>Student</th>
                                            <th>Score</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaderboard.map((lbEntry, idx) => {
                                            const isAnon = lbEntry.isAnonymous || lbEntry.preferences?.isAnonymous;
                                            const displayName = isAnon ? "Anonymous Student" : lbEntry.user;
                                            const displayAvatar = isAnon ? defaultAvatar : (lbEntry.avatar || defaultAvatar);
                                            return (
                                                <tr key={idx} className={idx < 3 ? `top-${idx+1}` : ''}>
                                                    <td className="lb-rank">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}</td>
                                                    <td className="lb-user">
                                                        <img src={displayAvatar} alt="avatar" />
                                                        <span>{displayName}</span>
                                                    </td>
                                                    <td className="lb-score">{lbEntry.score}/{lbEntry.maxScore}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* DETAILED ANSWERS */}
                        <div className="res-detailed-review">
                            <h3 className="rv-title">Detailed Review</h3>
                            <div className="rv-list">
                                {test.questions.map((q, index) => {
                                    const studentAns = answers[index];
                                    const qNum = index + 1;

                                    return (
                                        <div key={q._id} className="rv-item">
                                            <div className="rv-head">
                                                <span className="rv-idx">Q{qNum}</span>
                                                <span className={`rv-badge ${q.type === "essay" ? "na" : studentAns?.isCorrect ? "ok" : "bad"}`}>
                                                    {q.type === "essay" ? "Essay" : studentAns?.isCorrect ? "Correct" : "Incorrect"}
                                                </span>
                                            </div>

                                            <div className="rv-stem">
                                                <FormulaDisplay content={q.stem} />
                                            </div>

                                            {/* ESSAY GRADING UI */}
                                            {q.type === "essay" ? (
                                                <div className="rv-essay">
                                                    <div className="rv-essay-label" style={{ fontWeight: 'bold', color: 'var(--text-main)', marginBottom: '4px' }}>Your answer:</div>
                                                    <div className="rv-essay-text" style={{ color: 'var(--text-secondary)' }}>
                                                        {(studentAns?.studentAnswer || "").trim() || "— (empty) —"}
                                                    </div>
                                                    
                                                    {studentAns?.studentAnswer?.trim().length > 0 && (
                                                        <div style={{ marginTop: '16px' }}>
                                                            {!studentAns.score ? (
                                                                <button 
                                                                    className={`ai-grade-btn ${gradingLoading[qNum] ? 'loading' : ''}`}
                                                                    onClick={() => handleTriggerAIGrading(qNum)}
                                                                    disabled={gradingLoading[qNum]}
                                                                >
                                                                    {gradingLoading[qNum] ? (
                                                                        <><span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" style={{marginRight: '8px'}}></span> AI is analyzing in background...</>
                                                                    ) : <><i className="bi bi-stars"></i> Grade with AI</>}
                                                                </button>
                                                            ) : (
                                                                <div className="ai-result-box">
                                                                    <div className="ai-result-header">
                                                                        <div className="ai-title"><i className="bi bi-robot"></i> AI Assessment</div>
                                                                        <span className={`ai-score-badge ${studentAns.score >= 8 ? 'ai-score-high' : studentAns.score >= 5 ? 'ai-score-med' : 'ai-score-low'}`}>
                                                                            Score: {studentAns.score}/10
                                                                        </span>
                                                                    </div>
                                                                    <div className="ai-feedback"><strong>Feedback: </strong> {studentAns.aiFeedback}</div>
                                                                    {studentAns.aiSuggestion && (
                                                                        <div className="ai-suggestion"><i className="bi bi-lightbulb-fill"></i> <strong>Suggestion: </strong>{studentAns.aiSuggestion}</div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                /* MCQ / TF UI */
                                                <ul className="rv-choices">
                                                    {q.choices.map((c, ci) => {
                                                        const isCorrect = ci === (q.type === 'boolean' ? (q.correctBool ? 0 : 1) : q.correctIndex);
                                                        const isChosen = ci === parseInt(studentAns?.studentAnswer);
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
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <SiteFooter />

            {/* HỘP TOAST NẰM DƯỚI CÙNG */}
            {toast.show && (
                <div className={`toast ${toast.type}`}>
                    {toast.type === "success" ? <i className="bi bi-check-circle-fill"></i> : <i className="bi bi-exclamation-triangle-fill"></i>}
                    {toast.msg}
                </div>
            )}
        </div>
    );
}