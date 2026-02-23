import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import skillsPlaceholder from "../images/skills-placeholder.png";
import { toAbsolute } from "../utils/url";
import "../css/AllTests.css";

// List of available time limit options for the test preview dropdown
const TIME_OPTIONS = [
    { key: "unlimited", label: "Unlimited", minutes: null },
    { key: "45", label: "45 minutes", minutes: 45 },
    { key: "50", label: "50 minutes", minutes: 50 },
    { key: "60", label: "60 minutes", minutes: 60 },
];

// Mapping of raw database subject keys to user-friendly display labels
const SUBJECT_LABEL = {
    math: "Mathematics",
    physics: "Physics",
    chemistry: "Chemistry",
    english: "English",
};

// Predefined order for rendering subject tabs in the UI
const SUBJECT_ORDER = ["Mathematics", "English", "Physics", "Chemistry"];

/**
 * Helper function to extract the first recognized difficulty level from a test's tags array.
 * @param {Array} tags - Array of string tags associated with a test.
 * @returns {String} The matched difficulty level, or "General" if none found.
 */
const FIRST_DIFF_FROM_TAGS = (tags = []) => {
    const diffs = ["Easy", "Medium", "Hard", "Beginner", "Intermediate", "Advanced"];
    return tags.find((t) => diffs.includes(t)) || "General";
};

/**
 * Main component for displaying, filtering, and previewing the list of all available public tests
 */
export default function Tests() {
    const navigate = useNavigate();

    // Server Data
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errMsg, setErrMsg] = useState("");

    // UI & Interactions
    const [timeByTest, setTimeByTest] = useState({}); // Stores selected time limit for each test
    const [previewId, setPreviewId] = useState(null); // ID of the test currently being previewed in the modal
    const [query, setQuery] = useState("");           // Search bar input value
    const [activeTab, setActiveTab] = useState("All"); // Currently selected subject tab


    // Fetches the list of public tests from the backend API, normalizes the data for UI consumption, and updates local state
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

            // Normalize backend data structure for easier frontend rendering
            const normalized = (Array.isArray(list) ? list : []).map((t) => ({
                id: t._id, // Used for routing and preview tracking
                title: t.title,
                subjectKey: t.subject,
                subject: SUBJECT_LABEL[t.subject] || t.subject || "Unknown",
                grade: t.grade,
                questions: t.numQuestions || (t.questions?.length || 0),
                difficulty: FIRST_DIFF_FROM_TAGS(t.tags),
                description: t.description || "",
                thumb: skillsPlaceholder,
                tags: t.tags || [],
            }));

            setTests(normalized);

            // Fallback to the "All" tab if the currently active subject tab no longer exists in the newly fetched data
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

    // Trigger initial data fetch on component mount
    useEffect(() => {
        load();
    }, []);

    // Automatically refresh the test list whenever the user returns to the browser tab
    useEffect(() => {
        const onFocus = () => load();
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, []);

    // Memoize the specific test object that is currently being previewed to prevent unnecessary recalculations
    const previewTest = useMemo(
        () => tests.find((t) => t.id === previewId) || null,
        [previewId, tests]
    );

    /**
     * Handles changing the selected time limit in the preview modal.
     * @param {String} testId - The ID of the test.
     * @param {String} key - The selected time option key.
     */
    const onChangeTime = (testId, key) => {
        const opt = TIME_OPTIONS.find((o) => o.key === key);
        setTimeByTest((prev) => ({ ...prev, [testId]: opt?.key || "unlimited" }));
    };

    /**
     * Navigates the user to the Test Player page, passing the selected time limit as a URL parameter.
     * @param {Object} test - The test object to start.
     */
    const onStart = (test) => {
        const key = timeByTest[test.id] || "unlimited";
        const opt = TIME_OPTIONS.find((o) => o.key === key);
        const minutes = opt?.minutes;
        const qs = minutes ? `?time=${minutes}` : "";
        navigate(`/tests/${test.id}${qs}`);
    };

    /**
     * Dynamically generates the list of subject tabs based on the available data.
     * Only displays tabs for subjects that actually have tests.
     */
    const SUBJECT_TABS = useMemo(() => {
        const present = new Set(tests.map((t) => t.subject));
        return ["All", ...SUBJECT_ORDER.filter((s) => present.has(s))];
    }, [tests]);

    /**
     * Filters the tests based on the selected subject tab and the user's search query.
     */
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

    /**
     * Groups the filtered tests by subject to display categorized sections 
     * when the "All" tab is active.
     */
    const groupedBySubject = useMemo(() => {
        const map = new Map();
        filtered.forEach((t) => {
        const key = t.subject;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(t);
        });

        // Returns an array of tuples: [ [SubjectName, [TestArray]], ... ]
        return SUBJECT_ORDER
            .filter((s) => map.has(s))
            .map((s) => [s, map.get(s)]); // [subject, items]
    }, [filtered, SUBJECT_TABS]);

    return (
        <div className="tests-page">
        <SiteHeader />

        <div className="tests-container">
            {/* Toolbar: Search input and Category Tabs */}
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

            {/* Error and Loading States */}
            {errMsg && <div className="empty-state">Load failed: {errMsg}</div>}
            {loading && <div className="empty-state">Loading…</div>}

            {/* Main Content Grid */}
            {!loading && !errMsg && (
            <>
                {/* Condition 1: "All" tab is active -> Show categorized sections */}
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
                
                /* Condition 2: A specific Subject tab is active -> Show single grid */
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

        {/* Displays test details and time limit options before starting */}
        {previewTest && (
            <div className="modal-backdrop" onClick={() => setPreviewId(null)}>
                <div className="modal-card test-preview-enhanced" onClick={(e) => e.stopPropagation()}>
                    <button className="modal-close" aria-label="Close" onClick={() => setPreviewId(null)}>
                        <i className="bi bi-x-lg"></i>
                    </button>

                    {/* Header: Contains tags, title, and full description */}
                    <div className="tp-enhanced-header">
                        <div className="tp-badges">
                            <span className={`chip chip-${(previewTest.subjectKey || "").toLowerCase()}`}>
                                {previewTest.subject}
                            </span>
                            <span className="chip chip-level">{previewTest.difficulty}</span>
                            {previewTest.grade && (
                                <span className="chip chip-grade">Grade {previewTest.grade}</span>
                            )}
                        </div>
                        <h3 className="tp-title-large">{previewTest.title}</h3>
                        <p className="tp-desc-full">
                            {previewTest.description || "No description provided for this test. Are you ready to challenge yourself?"}
                        </p>
                    </div>

                    {/* Body: Contains visually separated statistic boxes */}
                    <div className="tp-enhanced-body">
                        <div className="tp-stat-box">
                            <div className="tp-stat-icon">
                                <i className="bi bi-ui-checks-grid"></i>
                            </div>
                            <div className="tp-stat-info">
                                <span className="tp-stat-label">Questions</span>
                                <span className="tp-stat-value">{previewTest.questions} Qs</span>
                            </div>
                        </div>

                        {/* Time Limit Selector Box */}
                        <div className="tp-stat-box">
                            <div className="tp-stat-icon" style={{ background: '#fff5f5', color: '#ef4444' }}>
                                <i className="bi bi-stopwatch"></i>
                            </div>
                            <div className="tp-stat-info">
                                <label className="tp-stat-label" htmlFor="time-select">Time Limit</label>
                                <select
                                    id="time-select"
                                    className="tp-select-clean"
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
                    </div>

                    {/* Actions: Cancel and Start Buttons */}
                    <div className="tp-enhanced-actions">
                        <button className="ghost-btn" onClick={() => setPreviewId(null)}>
                            Cancel
                        </button>
                        <button
                            className="start-test-btn"
                            onClick={() => onStart(previewTest)}
                        >
                            Start Practicing <i className="bi bi-arrow-right"></i>
                        </button>
                    </div>
                </div>
            </div>
        )}
        </div>
    );
}