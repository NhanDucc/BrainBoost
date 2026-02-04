import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { toAbsolute } from "../utils/url";
import FormulaDisplay from "./FormulaDisplay";
import "../css/TestPlayer.css";

/* Helpers */
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
function formatSeconds(s) {
    if (s == null) return "Unlimited";
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return hh ? `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}` : `${pad2(mm)}:${pad2(ss)}`;
}
const ABC = ["A", "B", "C", "D"];

export default function TestPlayer() {
    const { id } = useParams();
    const [sp] = useSearchParams();
    const navigate = useNavigate();

    // read time= (minutes) from URL
    const minutes = useMemo(() => {
        const t = sp.get("time");
        if (!t) return null; // Unlimited
        const m = parseInt(t, 10);
        return Number.isFinite(m) && m > 0 ? m : null;
    }, [sp]);

    const [paper, setPaper] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [highlight, setHighlight] = useState(true);

    /** answers:
     * - MCQ / Boolean: number (index)
     * - Essay: string (free text)
     */
    const [answers, setAnswers] = useState({});
    const [reviewSet, setReviewSet] = useState(() => new Set());
    const [pi, setPi] = useState(0);
    const [qi, setQi] = useState(0);

    const [secondsLeft, setSecondsLeft] = useState(minutes ? minutes * 60 : null);
    const timerRef = useRef(null);

    // results screen data
    const [result, setResult] = useState(null);

    const LS_KEY = `test-session:${id}`;

    // Load test from API
    useEffect(() => {
        let ignore = false;
        async function load() {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(toAbsolute(`/api/tests/public/${id}`));
            if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.message || `HTTP ${res.status}`);
            }
            const data = await res.json();

            // Map DB -> player paper shape
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
                answer:
                    typeof q.correctIndex === "number" ? q.correctIndex : undefined,
                };
            }
            if (base.type === "boolean") {
                return {
                ...base,
                // render như 2 lựa chọn
                choices: ["True", "False"],
                answer:
                    typeof q.correctBool === "boolean"
                    ? (q.correctBool ? 0 : 1) // True -> 0, False -> 1
                    : undefined,
                };
            }
            // essay
            return { ...base, choices: [] }; // không auto-grade
            });

            const mapped = {
            title: data.title,
            subject: data.subject,
            parts: [{ name: "Part", questions }],
            };

            if (!ignore) {
            setPaper(mapped);

            // restore local session (if any)
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
        return () => {
        ignore = true;
        };
        // eslint-disable-next-line
    }, [id]);

    // Timer tick
    useEffect(() => {
        if (secondsLeft == null || secondsLeft <= 0) return;
        timerRef.current = setInterval(
        () => setSecondsLeft((s) => (s == null ? null : s - 1)),
        1000
        );
        return () => clearInterval(timerRef.current);
    }, [secondsLeft]);

    // Auto submit on time up
    useEffect(() => {
        if (secondsLeft === 0) handleSubmit(true);
        // eslint-disable-next-line
    }, [secondsLeft]);

    // Persist progress
    useEffect(() => {
        if (result) return; // don't persist after submit
        const payload = {
        answers,
        reviewIds: Array.from(reviewSet),
        pointer: { pi, qi },
        secondsLeft,
        };
        localStorage.setItem(LS_KEY, JSON.stringify(payload));
    }, [answers, reviewSet, pi, qi, secondsLeft, result]);

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

    // set answers
    const setAnswerIndex = (qid, idx) =>
        setAnswers((prev) => ({ ...prev, [qid]: idx }));
    const setEssayText = (qid, text) =>
        setAnswers((prev) => ({ ...prev, [qid]: text }));

    const toggleReview = (qid) =>
        setReviewSet((s) => {
        const ns = new Set(s);
        ns.has(qid) ? ns.delete(qid) : ns.add(qid);
        return ns;
        });

    // Build result and show review screen
    const handleSubmit = (auto = false) => {
        const items = flatQuestions.map((q, i) => {
        const chosen = answers[q.id];
        if (q.type === "essay") {
            return {
            idx: i + 1,
            type: q.type,
            stem: q.stem,
            essayAnswer: typeof chosen === "string" ? chosen : "",
            isCorrect: null, // không chấm
            };
        }
        // mcq/boolean
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

        const gradableItems = items.filter(
        (it) => it.type === "mcq" || it.type === "boolean"
        );
        const correctCount = gradableItems.filter((x) => x.isCorrect).length;
        const gradableTotal = gradableItems.length;

        const attemptedCount =
        Object.keys(answers).filter((qid) => {
            const q = flatQuestions.find((x) => x.id === qid);
            if (!q) return false;
            if (q.type === "essay") return (answers[qid] || "").trim().length > 0;
            return typeof answers[qid] === "number";
        }).length;

        const incorrectCount =
        gradableItems.filter(
            (x) => x.chosen != null && x.isCorrect === false
        ).length;

        const unansweredCount = total - attemptedCount;
        const percent = gradableTotal
        ? Math.round((correctCount / gradableTotal) * 100)
        : 0;

        // stop timer + clear saved session
        clearInterval(timerRef.current);
        localStorage.removeItem(LS_KEY);

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
        window.scrollTo({ top: 0, behavior: "smooth" });
        } catch {}
    };

    const retry = () => {
        setAnswers({});
        setReviewSet(new Set());
        setPi(0);
        setQi(0);
        setResult(null);
        setSecondsLeft(minutes ? minutes * 60 : null);
    };

    // palette answered flag
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

            {/* Results view */}
            {!loading && !error && paper && result && (
            <div className="tp-result">
                <div className="tp-header">
                <h2 className="tp-title">{paper.title}</h2>
                </div>

                <div className="res-summary">
                {result.auto && (
                    <div className="res-note">⏰ Auto submitted — time is up.</div>
                )}
                <div className="res-score">
                    <div className="big">
                    {result.correctCount}/{result.gradableTotal}
                    </div>
                    <div className="percent">{result.percent}%</div>
                </div>
                <div className="res-stats">
                    <span className="ok">✔ Correct: {result.correctCount}</span>
                    <span className="bad">✖ Incorrect: {result.incorrectCount}</span>
                    <span className="muted">
                    … Unanswered: {result.unansweredCount}
                    </span>
                </div>
                <div className="res-actions">
                    <button className="ghost-btn" onClick={() => navigate("/tests")}>
                    ← Back to Tests
                    </button>
                    <button className="primary-btn" onClick={retry}>
                    Retry
                    </button>
                </div>
                </div>

                <h3 className="rv-title">Answer review</h3>
                <div className="rv-list">
                {result.items.map((it) => (
                    <div key={it.idx} className="rv-item">
                    <div className="rv-head">
                        <span className="rv-idx">Q{it.idx}</span>
                        <span
                        className={`rv-badge ${
                            it.type === "essay"
                            ? "na"
                            : it.chosen == null
                            ? "na"
                            : it.isCorrect
                            ? "ok"
                            : "bad"
                        }`}
                        >
                        {it.type === "essay"
                            ? "Essay"
                            : it.chosen == null
                            ? "Unanswered"
                            : it.isCorrect
                            ? "Correct"
                            : "Incorrect"}
                        </span>
                    </div>

                    {/* SỬ DỤNG MATH DISPLAY CHO NỘI DUNG CÂU HỎI */}
                    <div className="rv-stem">
                        <FormulaDisplay content={it.stem} />
                    </div>

                    {it.type === "essay" ? (
                        <div className="rv-essay">
                        <div className="rv-essay-label">Your answer:</div>
                        <div className="rv-essay-text">
                            {(it.essayAnswer || "").trim() || "— (empty) —"}
                        </div>
                        </div>
                    ) : (
                        <ul className="rv-choices">
                        {it.choices.map((c, ci) => {
                            const isCorrect = ci === it.correct;
                            const isChosen = ci === it.chosen;
                            return (
                            <li
                                key={ci}
                                className={[
                                "rv-choice",
                                isCorrect ? "correct" : "",
                                isChosen && !isCorrect ? "chosen" : "",
                                ].join(" ")}
                            >
                                <span className="rv-index">
                                {ABC[ci] ?? (ci === 0 ? "T" : "F")}.
                                </span>
                                {/* SỬ DỤNG MATH DISPLAY CHO ĐÁP ÁN */}
                                <span className="rv-text">
                                    <FormulaDisplay content={c} />
                                </span>
                                
                                {isCorrect && <span className="rv-tag">Correct</span>}
                                {isChosen && !isCorrect && (
                                <span className="rv-tag wrong">Your choice</span>
                                )}
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

            {/* ===== Player view ===== */}
            {!loading && !error && paper && !result && (
            <>
                {/* Header */}
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
                {/* Left: content */}
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
                        {/* SỬ DỤNG MATH DISPLAY CHO ĐỀ BÀI */}
                        <div className="tp-stem">
                            <FormulaDisplay content={current.stem} />
                        </div>

                        {/* MCQ */}
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
                                    {/* SỬ DỤNG MATH DISPLAY CHO LỰA CHỌN */}
                                    <span className="choice-text">
                                        <FormulaDisplay content={c} />
                                    </span>
                                    </label>
                                </li>
                                );
                            })}
                            </ul>
                        )}

                        {/* TRUE / FALSE */}
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

                        {/* ESSAY */}
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

                {/* Right: palette */}
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