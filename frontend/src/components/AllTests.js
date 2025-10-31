import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import skillsPlaceholder from "../images/skills-placeholder.png";
import { toAbsolute } from "../utils/url";
import "../css/AllTests.css";

/** dropdown options (minutes) */
const TIME_OPTIONS = [
    { key: "unlimited", label: "Unlimited", minutes: null },
    { key: "45", label: "45 minutes", minutes: 45 },
    { key: "50", label: "50 minutes", minutes: 50 },
    { key: "60", label: "60 minutes", minutes: 60 },
];

const SUBJECT_LABEL = {
    math: "Mathematics",
    physics: "Physics",
    chemistry: "Chemistry",
    english: "English",
};

const SUBJECT_ORDER = ["Mathematics", "English", "Physics", "Chemistry"];

const FIRST_DIFF_FROM_TAGS = (tags = []) => {
    // pick first matching tag as "difficulty"
    const diffs = ["Easy", "Medium", "Hard", "Beginner", "Intermediate", "Advanced"];
    return tags.find((t) => diffs.includes(t)) || "General";
};

export default function Tests() {
    const navigate = useNavigate();

    // server data
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errMsg, setErrMsg] = useState("");

    // UI state
    const [timeByTest, setTimeByTest] = useState({});
    const [previewId, setPreviewId] = useState(null);
    const [query, setQuery] = useState("");
    const [activeTab, setActiveTab] = useState("All");

    // fetch from API
    const load = async () => {
        try {
        setLoading(true);
        setErrMsg("");
        const res = await fetch(toAbsolute("/api/tests/public"));
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.message || `HTTP ${res.status}`);
        }
        const list = await res.json();

        // normalize for UI
        const normalized = (Array.isArray(list) ? list : []).map((t) => ({
            id: t._id, // used for routing/preview
            title: t.title,
            subjectKey: t.subject,
            subject: SUBJECT_LABEL[t.subject] || t.subject || "Unknown",
            grade: t.grade,
            questions: t.numQuestions || (t.questions?.length || 0),
            difficulty: FIRST_DIFF_FROM_TAGS(t.tags),
            description: t.description || "",
            thumb: skillsPlaceholder, // you can map a real image later
            tags: t.tags || [],
        }));

        setTests(normalized);
        // update active tab if it was non-existent before
        if (activeTab !== "All") {
            const hasTab = normalized.some((x) => x.subject === activeTab);
            if (!hasTab) setActiveTab("All");
        }
        } catch (e) {
        setErrMsg(e.message || "Failed to load");
        } finally {
        setLoading(false);
        }
    };

    // initial load
    useEffect(() => {
        load();
    }, []);

    // auto refresh when page regains focus
    useEffect(() => {
        const onFocus = () => load();
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, []);

    const previewTest = useMemo(
        () => tests.find((t) => t.id === previewId) || null,
        [previewId, tests]
    );

    const onChangeTime = (testId, key) => {
        const opt = TIME_OPTIONS.find((o) => o.key === key);
        setTimeByTest((prev) => ({ ...prev, [testId]: opt?.key || "unlimited" }));
    };

    const onStart = (test) => {
        const key = timeByTest[test.id] || "unlimited";
        const opt = TIME_OPTIONS.find((o) => o.key === key);
        const minutes = opt?.minutes;
        const qs = minutes ? `?time=${minutes}` : "";
        navigate(`/tests/${test.id}${qs}`);
    };

    // tabs based on loaded data
    const SUBJECT_TABS = useMemo(() => {
        const present = new Set(tests.map((t) => t.subject));
        return ["All", ...SUBJECT_ORDER.filter((s) => present.has(s))];
    }, [tests]);

    // filter by tab + search
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return tests.filter((t) => {
        const byTab = activeTab === "All" ? true : t.subject === activeTab;
        const byQuery =
            !q ||
            t.title.toLowerCase().includes(q) ||
            (t.description || "").toLowerCase().includes(q) ||
            (t.subject || "").toLowerCase().includes(q);
        return byTab && byQuery;
        });
    }, [tests, activeTab, query]);

    // group by subject for "All"
    const groupedBySubject = useMemo(() => {
        const map = new Map();
        filtered.forEach((t) => {
        const key = t.subject;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(t);
        });
        return SUBJECT_ORDER
            .filter((s) => map.has(s))
            .map((s) => [s, map.get(s)]); // [subject, items]
    }, [filtered, SUBJECT_TABS]);

    return (
        <div className="tests-page">
        <SiteHeader />

        <div className="tests-container">
            {/* Toolbar */}
            <div className="tests-toolbar">
            <div className="searchbox">
                <span className="bi bi-search"></span>
                <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search exams…"
                aria-label="Search tests"
                />
                {query && (
                <button className="clear-btn" aria-label="Clear" onClick={() => setQuery("")}>
                    ×
                </button>
                )}
            </div>

            <div className="tabs">
                {SUBJECT_TABS.map((s) => (
                <button
                    key={s}
                    className={`tab ${activeTab === s ? "active" : ""}`}
                    onClick={() => setActiveTab(s)}
                >
                    {s}
                </button>
                ))}
            </div>
            </div>

            {/* States */}
            {errMsg && <div className="empty-state">Load failed: {errMsg}</div>}
            {loading && <div className="empty-state">Loading…</div>}

            {/* Content */}
            {!loading && !errMsg && (
            <>
                {activeTab === "All" ? (
                groupedBySubject.length ? (
                    groupedBySubject.map(([subject, items]) => (
                    <section key={subject} className="subject-section">
                        <h2 className="subject-title">{subject}</h2>
                        <div className="tests-grid">
                        {items.map((t) => (
                            <article
                            className="test-card"
                            key={t.id}
                            onClick={() => setPreviewId(t.id)}
                            >
                            <div className="test-thumb">
                                <img src={t.thumb || skillsPlaceholder} alt={`${t.subject} test`} />
                            </div>

                            <div className="test-info">
                                <div className="test-topline">
                                <span className={`chip chip-${(t.subjectKey || "").toLowerCase()}`}>
                                    {t.subject}
                                </span>
                                <span className="chip chip-level">{t.difficulty}</span>
                                </div>

                                <h3 className="test-title">{t.title}</h3>
                                <p className="test-desc" title={t.description}>
                                {t.description}
                                </p>

                                <div className="test-meta">
                                <span className="bi bi-file-earmark-text-fill"> {t.questions} questions</span>
                                </div>
                            </div>

                            <div className="test-actions">
                                <button
                                className="ghost-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewId(t.id);
                                }}
                                >
                                View details
                                </button>
                            </div>
                            </article>
                        ))}
                        </div>
                    </section>
                    ))
                ) : (
                    <p className="empty-state">No tests found.</p>
                )
                ) : (
                <section className="subject-section">
                    <h2 className="subject-title">{activeTab}</h2>
                    <div className="tests-grid">
                    {filtered.map((t) => (
                        <article
                        className="test-card"
                        key={t.id}
                        onClick={() => setPreviewId(t.id)}
                        >
                        <div className="test-thumb">
                            <img src={t.thumb || skillsPlaceholder} alt={`${t.subject} test`} />
                        </div>

                        <div className="test-info">
                            <div className="test-topline">
                            <span className={`chip chip-${(t.subjectKey || "").toLowerCase()}`}>
                                {t.subject}
                            </span>
                            <span className="chip chip-level">{t.difficulty}</span>
                            </div>

                            <h3 className="test-title">{t.title}</h3>
                            <p className="test-desc" title={t.description}>
                            {t.description}
                            </p>

                            <div className="test-meta">
                            <span>📄 {t.questions} questions</span>
                            </div>
                        </div>

                        <div className="test-actions">
                            <button
                            className="ghost-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                setPreviewId(t.id);
                            }}
                            >
                            View details
                            </button>
                        </div>
                        </article>
                    ))}
                    </div>
                    {!filtered.length && <p className="empty-state">No tests found.</p>}
                </section>
                )}
            </>
            )}
        </div>

        <SiteFooter />

        {/* Preview Modal */}
        {previewTest && (
            <div className="modal-backdrop" onClick={() => setPreviewId(null)}>
            <div className="modal-card test-preview" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" aria-label="Close" onClick={() => setPreviewId(null)}>
                ×
                </button>

                <div className="tp-head">
                <span className="tp-badge">Preview</span>
                <h3 className="tp-title">{previewTest.title}</h3>
                </div>

                <div className="tp-body">
                <div className="tp-row">
                    <span className="tp-label">Number of questions</span>
                    <span className="tp-value">{previewTest.questions}</span>
                </div>

                <div className="tp-row">
                    <label className="tp-label" htmlFor="time-select">
                    Time to do the test
                    </label>
                    <select
                    id="time-select"
                    className="tp-select"
                    value={timeByTest[previewTest.id] || "unlimited"}
                    onChange={(e) => onChangeTime(previewTest.id, e.target.value)}
                    >
                    {TIME_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>
                        {o.label}
                        </option>
                    ))}
                    </select>
                </div>
                </div>

                <div className="tp-actions">
                <button className="ghost-btn" onClick={() => setPreviewId(null)}>
                    Close
                </button>
                <button
                    className="primary-btn"
                    onClick={() => {
                    onStart(previewTest);
                    }}
                >
                    Start
                </button>
                </div>
            </div>
            </div>
        )}
        </div>
    );
}
