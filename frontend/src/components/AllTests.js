import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import skillsPlaceholder from "../images/skills-placeholder.png";
import { toAbsolute } from "../utils/url";
import { api } from "../api";
import "../css/AllTests.css";

// ==== Constants & Configuration ====

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

// System-defined difficulty levels
const DIFFS = ["Easy", "Medium", "Hard"];

/**
 * Helper function to extract the first recognized difficulty level from a test's tags array.
 * @param {Array} tags - Array of string tags associated with a test.
 * @returns {String} The matched difficulty level, or "General" if none found.
 */
const FIRST_DIFF_FROM_TAGS = (tags = []) => {
    return tags.find((t) => DIFFS.includes(t)) || "General";
};

// ==== Main Component ====

/**
 * Main component for displaying, filtering, and previewing the list of all available public tests
 */
export default function Tests() {
    const navigate = useNavigate();

    // ---- State Management ----

    // Server Data
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [errMsg, setErrMsg] = useState("");

    // UI & Interactions
    const [timeByTest, setTimeByTest] = useState({}); // Stores selected time limit for each test
    const [previewId, setPreviewId] = useState(null); // ID of the test currently being previewed in the modal
    const [query, setQuery] = useState("");           // Search bar input value
    const [activeTab, setActiveTab] = useState("All"); // Currently selected subject tab

    // Filter states for Grade and Difficulty dropdowns
    const [filterGrade, setFilterGrade] = useState("All");
    const [filterDiff, setFilterDiff] = useState("All");

    // Bookmark State
    const [bookmarkedIds, setBookmarkedIds] = useState(new Set());

    // ---- Data Fetching ----

    /**
     * Fetches the list of public tests from the backend API, 
     * normalizes the data for UI consumption, and updates local state.
     */
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
                id: t._id,
                title: t.title,
                subjectKey: t.subject,
                subject: SUBJECT_LABEL[t.subject] || t.subject || "Unknown",
                grade: t.grade,
                questions: t.numQuestions || (t.questions?.length || 0),
                difficulty: FIRST_DIFF_FROM_TAGS(t.tags),
                description: t.description || "",
                thumb: skillsPlaceholder,
                tags: t.tags || [],
                customTags: (t.tags || []).filter(tag => !DIFFS.includes(tag)),
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

    /**
     * Initial data load when the component mounts.
     * Also fetches the user's bookmarked tests to set initial button states.
     */
    useEffect(() => {
        load();
        
        // Fetch saved tests API. If the user is not logged in, silently ignore the error
        const fetchBookmarks = async () => {
            try {
                const res = await api.get("/learning/bookmarks");
                if (res.data) {
                    const ids = new Set(res.data.map(b => b.id));
                    setBookmarkedIds(ids);
                }
            } catch (error) {
                // Ignore if user is not logged in
            }
        };
        fetchBookmarks();
    }, []);

    /**
     * Automatically refresh the test list whenever the user returns to the browser tab
     * to ensure data is always up-to-date.
     */
    useEffect(() => {
        const onFocus = () => load();
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, []);

    // ---- Event Handlers ----

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
     * Calls the API to add or remove a test from the user's bookmarks.
     * Updates the UI optimistically if successful.
     */
    const handleToggleBookmark = async (testId, e) => {
        e.stopPropagation();
        try {
            const res = await api.post("/learning/bookmarks/toggle", { testId });
            setBookmarkedIds(prev => {
                const newSet = new Set(prev);
                if (res.data.isBookmarked) newSet.add(testId);
                else newSet.delete(testId);
                return newSet;
            });
        } catch (error) {
            console.error("Failed to toggle bookmark");
            alert("Please login to save tests.");
        }
    };
    
    // ---- Memoized Computations & Filters ----

    /**
     * Dynamically generates the list of subject tabs based on the available data.
     * Only displays tabs for subjects that actually have tests.
     */
    const SUBJECT_TABS = useMemo(() => {
        const present = new Set(tests.map((t) => t.subject));
        return ["All", ...SUBJECT_ORDER.filter((s) => present.has(s))];
    }, [tests]);

    /**
     * Automatically retrieves a list of existing Grade levels from the fetched tests.
     * Sorts them numerically.
     */
    const AVAILABLE_GRADES = useMemo(() => {
        const grades = new Set(tests.map(t => t.grade).filter(Boolean));

        const sortedGrades = Array.from(grades).sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, ''));
            const numB = parseInt(b.replace(/\D/g, ''));
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b);
        });
        return ["All", ...sortedGrades];
    }, [tests]);

    /**
     * Automatically retrieves a list of existing Difficulty levels from the fetched tests.
     * Enforces a strict display order (Easy -> Medium -> Hard) based on the DIFFS constant.
     */
    const AVAILABLE_DIFFS = useMemo(() => {
        const presentDiffs = new Set(tests.map(t => t.difficulty).filter(d => d !== "General"));
        const sortedDiffs = DIFFS.filter(d => presentDiffs.has(d));
        return ["All", ...sortedDiffs];
    }, [tests]);

    /**
     * Master filter function.
     * Filters the tests based on: active subject tab, search query, selected grade, and selected difficulty.
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
        
        const byGrade = filterGrade === "All" ? true : t.grade === filterGrade;
        const byDiff = filterDiff === "All" ? true : t.difficulty === filterDiff;
        
        return byTab && byQuery && byGrade && byDiff;
        });
    }, [tests, activeTab, query, filterGrade, filterDiff]);

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

    // ---- Render UI ----

    return (
        <div className="tests-page">
        <SiteHeader />

        <div className="tests-container">
            {/* ==== Toolbar: Search, Filters and Category Tabs ==== */}
            <div className="tests-toolbar">
                <div className="toolbar-top-row">
                    <div className="searchbox">
                        <span className="bi bi-search"></span>
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search exams…"
                            aria-label="Search tests"
                        />
                        {query && (
                            <button className="clear-btn" aria-label="Clear" onClick={() => setQuery("")}>×</button>
                        )}
                    </div>

                    {/* Dropdown Filters (Grade & Difficulty) */}
                    <div className="filter-group">
                        <div className="filter-item">
                            <i className="bi bi-mortarboard-fill"></i>
                            <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)}>
                                <option value="All">All Grades</option>
                                {AVAILABLE_GRADES.filter(g => g !== "All").map(g => (
                                    <option key={g} value={g}>Grade {g}</option>
                                ))}
                            </select>
                        </div>
                        <div className="filter-item">
                            <i className="bi bi-bar-chart-steps"></i>
                            <select value={filterDiff} onChange={(e) => setFilterDiff(e.target.value)}>
                                <option value="All">All Difficulties</option>
                                {AVAILABLE_DIFFS.filter(d => d !== "All").map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Subject Tabs */}
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

            {/* ==== Main Content Grid ==== */}
            {!loading && !errMsg && (
            <>
                {/* Condition 1: "All" tab is active -> Show horizontally grouped subject sections */}
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
                                <div className="test-topline" style={{ flexWrap: 'wrap' }}>
                                    <span className={`chip chip-${(t.subjectKey || "").toLowerCase()}`}>
                                        {t.subject}
                                    </span>
                                    <span className="chip chip-level">{t.difficulty}</span>

                                    {/* Grade Tag */}
                                    {t.grade && (
                                        <span className="chip chip-grade">Grade {t.grade}</span>
                                    )}

                                    {/* Custom Tags created by Instructors */}
                                    {t.customTags && t.customTags.map(ct => (
                                        <span key={ct} className="chip chip-custom">{ct}</span>
                                    ))}
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
                
                /* Condition 2: A specific Subject tab is active -> Show a single, uniform grid */
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
                            <div className="test-topline" style={{ flexWrap: 'wrap' }}>
                                <span className={`chip chip-${(t.subjectKey || "").toLowerCase()}`}>
                                    {t.subject}
                                </span>
                                <span className="chip chip-level">{t.difficulty}</span>

                                {/* Grade Tag */}
                                {t.grade && (
                                    <span className="chip chip-grade">Grade {t.grade}</span>
                                )}

                                {/* Custom Tags created by Instructors */}
                                {t.customTags && t.customTags.map(ct => (
                                    <span key={ct} className="chip chip-custom">{ct}</span>
                                ))}
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

        {/* ==== Preview Modal ==== */}
        {/* Displays test details, tags, and start options */}
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
                            
                            {/* Custom Tags */}
                            {previewTest.customTags && previewTest.customTags.map(ct => (
                                <span key={ct} className="chip chip-custom">{ct}</span>
                            ))}
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

                    {/* Actions: Cancel, Save, and Start Buttons */}
                    <div className="tp-enhanced-actions" style={{ justifyContent: 'space-between' }}>
                        
                        {/* Save Test (Bookmark) Button */}
                        <button 
                            className="ghost-btn" 
                            style={{ 
                                color: bookmarkedIds.has(previewTest.id) ? '#ea580c' : '#64748b', 
                                borderColor: bookmarkedIds.has(previewTest.id) ? '#fef08a' : '#e2e8f0', 
                                background: bookmarkedIds.has(previewTest.id) ? '#fefce8' : 'transparent' 
                            }}
                            onClick={(e) => handleToggleBookmark(previewTest.id, e)}
                        >
                            <i className={`bi bi-bookmark-${bookmarkedIds.has(previewTest.id) ? 'star-fill' : 'plus'}`}></i> 
                            {bookmarkedIds.has(previewTest.id) ? ' Saved' : ' Save for later'}
                        </button>

                        <div style={{ display: 'flex', gap: '12px' }}>
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
            </div>
        )}
        </div>
    );
}