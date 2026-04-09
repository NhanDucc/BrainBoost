import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import skillsPlaceholder from "../images/skills-placeholder.png";
import { toAbsolute } from "../utils/url";
import { api } from "../api";
import "../css/AllTests.css";

// ==== Constants & Configurations ====

// Predefined time limit options for the test preview modal
const TIME_OPTIONS = [
    { key: "unlimited", label: "Unlimited", minutes: null },
    { key: "45", label: "45 minutes", minutes: 45 },
    { key: "50", label: "50 minutes", minutes: 50 },
    { key: "60", label: "60 minutes", minutes: 60 },
];

// Mapping for user-friendly subject labels
const SUBJECT_LABEL = { math: "Mathematics", physics: "Physics", chemistry: "Chemistry", english: "English" };
// Defined order for subject tabs in the UI
const SUBJECT_ORDER = ["Mathematics", "English", "Physics", "Chemistry"];
// Standard difficulty levels
const DIFFS = ["Easy", "Medium", "Hard"];

/**
 * Helper function to extract the standard difficulty level from a test's tags array.
 * Defaults to "General" if no matching tag is found.
 */
const FIRST_DIFF_FROM_TAGS = (tags = []) => tags.find((t) => DIFFS.includes(t)) || "General";

// ==== Main Component ====

export default function Tests() {
    const navigate = useNavigate();

    // ---- Data & Network States ----
    const [tests, setTests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errMsg, setErrMsg] = useState("");

    // ---- UI & Interaction States ----
    const [timeByTest, setTimeByTest] = useState({});
    const [previewId, setPreviewId] = useState(null);
    const [bookmarkedIds, setBookmarkedIds] = useState(new Set());

    // ---- Filter & Search States ----
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [activeTab, setActiveTab] = useState("All");
    const [filterGrade, setFilterGrade] = useState("All");
    const [filterDiff, setFilterDiff] = useState("All");

    // ==== Side Effects ====

    /**
     * Debounce Search Effect: 
     * Waits 400ms after the user stops typing before updating the actual search state.
     */
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedQuery(query), 400);
        return () => clearTimeout(handler);
    }, [query]);

    /**
     * Fetch API with Cache-First (Stale-While-Revalidate) Strategy
     */
    const load = async () => {
        try {
            const cacheKey = "public_tests_v1";
            
            // 1. Check Session Storage for cached data
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) {
                setTests(JSON.parse(cached));
                setLoading(false); // Hide skeletons immediately if cache exists
            } else {
                setLoading(true);
            }
            setErrMsg("");

            // 2. Fetch fresh data from the server in the background
            const res = await fetch(toAbsolute("/api/tests/public"));
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.message || `HTTP ${res.status}`);
            }
            const list = await res.json();

            // Normalize the raw data for easier UI consumption
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
                customTags: (t.tags || []).filter(tag => !DIFFS.includes(tag)), // Extract non-standard tags
            }));

            // 3. Update state and cache with fresh data
            setTests(normalized);
            sessionStorage.setItem(cacheKey, JSON.stringify(normalized)); 
            setLoading(false);
            
        } catch (e) {
            setErrMsg(e.message || "Failed to load");
            setLoading(false);
        }
    };

    /**
     * Initial component mount effect. Loads tests and user bookmarks.
     */
    useEffect(() => {
        load();
        
        // Fetch bookmarked tests for the logged-in user
        const fetchBookmarks = async () => {
            try {
                const res = await api.get("/learning/bookmarks");
                if (res.data) setBookmarkedIds(new Set(res.data.map(b => b.id)));
            } catch (error) {
                // Silently ignore if user is not logged in
            }
        };
        fetchBookmarks();
    }, []);

    /**
     * Window focus listener to refresh the list automatically when the user returns to the tab.
     */
    useEffect(() => {
        const onFocus = () => load();
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, []);

    // ==== Event Handlers ====

    // Memoize the test object currently being previewed
    const previewTest = useMemo(() => tests.find((t) => t.id === previewId) || null, [previewId, tests]);

    // Updates the selected time limit in the preview modal
    const onChangeTime = (testId, key) => setTimeByTest((prev) => ({ ...prev, [testId]: key || "unlimited" }));

    // Navigates to the Test Player, passing the selected time as a query parameter
    const onStart = (test) => {
        const key = timeByTest[test.id] || "unlimited";
        const opt = TIME_OPTIONS.find((o) => o.key === key);
        navigate(`/tests/${test.id}${opt?.minutes ? `?time=${opt.minutes}` : ""}`);
    };

    // Toggles the bookmark status via API and updates the local state optimistically
    const handleToggleBookmark = async (testId, e) => {
        e.stopPropagation(); // Prevent opening the modal when clicking the bookmark button
        try {
            const res = await api.post("/learning/bookmarks/toggle", { testId });
            setBookmarkedIds(prev => {
                const newSet = new Set(prev);
                res.data.isBookmarked ? newSet.add(testId) : newSet.delete(testId);
                return newSet;
            });
        } catch (error) { 
            alert("Please login to save tests."); 
        }
    };
    
    // ==== Data Processing (Memoized for Performance) ====

    // Dynamically generate subject tabs based on available data
    const SUBJECT_TABS = useMemo(() => ["All", ...SUBJECT_ORDER.filter((s) => new Set(tests.map((t) => t.subject)).has(s))], [tests]);

    // Extract unique grades and sort them numerically
    const AVAILABLE_GRADES = useMemo(() => {
        const grades = new Set(tests.map(t => t.grade).filter(Boolean));
        const sortedGrades = Array.from(grades).sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, ''));
            const numB = parseInt(b.replace(/\D/g, ''));
            return (!isNaN(numA) && !isNaN(numB)) ? numA - numB : a.localeCompare(b);
        });
        return ["All", ...sortedGrades];
    }, [tests]);

    // Extract unique difficulties based on the standard DIFFS array
    const AVAILABLE_DIFFS = useMemo(() => {
        const presentDiffs = new Set(tests.map(t => t.difficulty).filter(d => d !== "General"));
        return ["All", ...DIFFS.filter(d => presentDiffs.has(d))];
    }, [tests]);

    // Master filter: Applies search query, tab, grade, and difficulty filters
    const filtered = useMemo(() => {
        const q = debouncedQuery.toLowerCase();
        return tests.filter((t) => {
            const byTab = activeTab === "All" ? true : t.subject === activeTab;
            const byQuery = !q || t.title.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q);
            const byGrade = filterGrade === "All" ? true : t.grade === filterGrade;
            const byDiff = filterDiff === "All" ? true : t.difficulty === filterDiff;
            return byTab && byQuery && byGrade && byDiff;
        });
    }, [tests, activeTab, debouncedQuery, filterGrade, filterDiff]);

    // Group tests by subject for rendering sections when the "All" tab is selected
    const groupedBySubject = useMemo(() => {
        const map = new Map();
        filtered.forEach((t) => { 
            if (!map.has(t.subject)) map.set(t.subject, []); 
            map.get(t.subject).push(t); 
        });
        return SUBJECT_ORDER.filter((s) => map.has(s)).map((s) => [s, map.get(s)]);
    }, [filtered]);

    // ==== UI Components ====

    /**
     * Skeleton UI for loading state to prevent Cumulative Layout Shift (CLS).
     */
    const SkeletonTestCard = () => (
        <article className="test-card skeleton-card">
            <div className="test-thumb skeleton skeleton-img"></div>
            <div className="test-info">
                <div className="test-topline">
                    <span className="skeleton skeleton-badge-small"></span>
                    <span className="skeleton skeleton-badge-small"></span>
                </div>
                <div className="skeleton skeleton-title" style={{ height: '24px', marginTop: '8px' }}></div>
                <div className="skeleton skeleton-title" style={{ height: '14px', width: '90%' }}></div>
                <div className="test-meta" style={{ marginTop: '12px' }}>
                    <span className="skeleton skeleton-badge-small" style={{ width: '80px' }}></span>
                </div>
            </div>
            <div className="test-actions" style={{ padding: '16px' }}>
                <div className="skeleton skeleton-btn" style={{ width: '100px', height: '36px', borderRadius: '10px' }}></div>
            </div>
        </article>
    );

    // ==== Main Render ====

    return (
        <div className="tests-page">
        <SiteHeader />
        <div className="tests-container">
            
            {/* ==== Toolbar & Filters ==== */}
            <div className="tests-toolbar">
                <div className="toolbar-top-row">
                    <div className="searchbox">
                        <span className="bi bi-search"></span>
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search exams…" />
                        {query && <button className="clear-btn" onClick={() => setQuery("")}>×</button>}
                    </div>
                    <div className="filter-group">
                        <div className="filter-item">
                            <i className="bi bi-mortarboard-fill"></i>
                            <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)}>
                                <option value="All">All Grades</option>
                                {AVAILABLE_GRADES.filter(g => g !== "All").map(g => (<option key={g} value={g}>Grade {g}</option>))}
                            </select>
                        </div>
                        <div className="filter-item">
                            <i className="bi bi-bar-chart-steps"></i>
                            <select value={filterDiff} onChange={(e) => setFilterDiff(e.target.value)}>
                                <option value="All">All Difficulties</option>
                                {AVAILABLE_DIFFS.filter(d => d !== "All").map(d => (<option key={d} value={d}>{d}</option>))}
                            </select>
                        </div>
                    </div>
                </div>
                
                {/* Subject Navigation Tabs */}
                <div className="tabs">
                    {SUBJECT_TABS.map((s) => (
                        <button key={s} className={`tab ${activeTab === s ? "active" : ""}`} onClick={() => setActiveTab(s)}>
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {errMsg && <div className="empty-state">Error: {errMsg}</div>}

            {/* Display Skeleton instead of basic "Loading..." text */}
            {loading && tests.length === 0 ? (
                <section className="subject-section">
                   <h2 className="subject-title skeleton skeleton-title" style={{ width: '150px' }}></h2>
                   <div className="tests-grid">{[...Array(8)].map((_, i) => <SkeletonTestCard key={i} />)}</div>
                </section>
            ) : (!errMsg && (
            <>
                {/* Logic for "All" Tab: Display sections for each subject */}
                {activeTab === "All" ? (
                groupedBySubject.length ? (
                    groupedBySubject.map(([subject, items]) => (
                    <section key={subject} className="subject-section">
                        <h2 className="subject-title">{subject}</h2>
                        <div className="tests-grid">
                        {items.map((t) => (
                            <article className="test-card" key={t.id} onClick={() => setPreviewId(t.id)}>
                                <div className="test-thumb"><img src={t.thumb} alt="" /></div>
                                <div className="test-info">
                                    <div className="test-topline" style={{ flexWrap: 'wrap' }}>
                                        <span className={`chip chip-${(t.subjectKey || "").toLowerCase()}`}>{t.subject}</span>
                                        <span className="chip chip-level">{t.difficulty}</span>
                                        {t.grade && <span className="chip chip-grade">Grade {t.grade}</span>}
                                        {t.customTags && t.customTags.map(ct => (<span key={ct} className="chip chip-custom">{ct}</span>))}
                                    </div>
                                    <h3 className="test-title">{t.title}</h3>
                                    <p className="test-desc" title={t.description}>{t.description}</p>
                                    <div className="test-meta"><span className="bi bi-file-earmark-text-fill"> {t.questions} questions</span></div>
                                </div>
                                <div className="test-actions">
                                    <button className="ghost-btn" onClick={(e) => { e.stopPropagation(); setPreviewId(t.id); }}>View details</button>
                                </div>
                            </article>
                        ))}
                        </div>
                    </section>
                    ))
                ) : ( <p className="empty-state">No tests found.</p> )
                ) : (
                /* Logic for Individual Subject Tab: Continuous grid */
                <section className="subject-section">
                    <h2 className="subject-title">{activeTab}</h2>
                    <div className="tests-grid">
                    {filtered.map((t) => (
                        <article className="test-card" key={t.id} onClick={() => setPreviewId(t.id)}>
                            <div className="test-thumb"><img src={t.thumb} alt="" /></div>
                            <div className="test-info">
                                <div className="test-topline" style={{ flexWrap: 'wrap' }}>
                                    <span className={`chip chip-${(t.subjectKey || "").toLowerCase()}`}>{t.subject}</span>
                                    <span className="chip chip-level">{t.difficulty}</span>
                                    {t.grade && <span className="chip chip-grade">Grade {t.grade}</span>}
                                    {t.customTags && t.customTags.map(ct => (<span key={ct} className="chip chip-custom">{ct}</span>))}
                                </div>
                                <h3 className="test-title">{t.title}</h3>
                                <p className="test-desc" title={t.description}>{t.description}</p>
                                <div className="test-meta"><span className="bi bi-file-earmark-text-fill"> {t.questions} questions</span></div>
                            </div>
                            <div className="test-actions">
                                <button className="ghost-btn" onClick={(e) => { e.stopPropagation(); setPreviewId(t.id); }}>View details</button>
                            </div>
                        </article>
                    ))}
                    </div>
                    {!filtered.length && <p className="empty-state">No tests found.</p>}
                </section>
                )}
            </>
            ))}
        </div>
        <SiteFooter />

        {/* ==== Test Preview Modal ==== */}
        {previewTest && (
            <div className="modal-backdrop" onClick={() => setPreviewId(null)}>
                <div className="modal-card test-preview-enhanced" onClick={(e) => e.stopPropagation()}>
                    <button className="modal-close" aria-label="Close" onClick={() => setPreviewId(null)}>
                        <i className="bi bi-x-lg"></i>
                    </button>
                    
                    <div className="tp-enhanced-header">
                        <div className="tp-badges">
                            <span className={`chip chip-${(previewTest.subjectKey || "").toLowerCase()}`}>{previewTest.subject}</span>
                            <span className="chip chip-level">{previewTest.difficulty}</span>
                            {previewTest.grade && <span className="chip chip-grade">Grade {previewTest.grade}</span>}
                            {previewTest.customTags && previewTest.customTags.map(ct => (<span key={ct} className="chip chip-custom">{ct}</span>))}
                        </div>
                        <h3 className="tp-title-large">{previewTest.title}</h3>
                        <p className="tp-desc-full">{previewTest.description || "Are you ready to challenge yourself?"}</p>
                    </div>
                    
                    <div className="tp-enhanced-body">
                        <div className="tp-stat-box">
                            <div className="tp-stat-icon"><i className="bi bi-ui-checks-grid"></i></div>
                            <div className="tp-stat-info">
                                <span className="tp-stat-label">Questions</span>
                                <span className="tp-stat-value">{previewTest.questions} Qs</span>
                            </div>
                        </div>
                        <div className="tp-stat-box">
                            <div className="tp-stat-icon" style={{ background: '#fff5f5', color: '#ef4444' }}>
                                <i className="bi bi-stopwatch"></i>
                            </div>
                            <div className="tp-stat-info">
                                <label className="tp-stat-label" htmlFor="time-select">Time Limit</label>
                                <select id="time-select" className="tp-select-clean" value={timeByTest[previewTest.id] || "unlimited"} onChange={(e) => onChangeTime(previewTest.id, e.target.value)}>
                                    {TIME_OPTIONS.map((o) => (<option key={o.key} value={o.key}>{o.label}</option>))}
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div className="tp-enhanced-actions" style={{ justifyContent: 'space-between' }}>
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
                            <button className="ghost-btn" onClick={() => setPreviewId(null)}>Cancel</button>
                            <button className="start-test-btn" onClick={() => onStart(previewTest)}>
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