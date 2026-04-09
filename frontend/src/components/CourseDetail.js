import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toAbsolute } from "../utils/url";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import "../css/CourseDetail.css";

// ==== Helper Functions ====

/**
 * Converts a total number of minutes into a human-readable string format.
 * Example: 90 -> "01 hrs 30 mins", 45 -> "45 mins"
 * @param {Number} mins - Total duration in minutes.
 * @returns {String} Formatted time string.
 */
const minutesToText = (mins) => {
    if (!mins || isNaN(mins) || mins === 0) return "0 mins";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    // Helper to pad single-digit numbers with a leading zero
    const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
    return h > 0 ? `${pad(h)} hrs ${pad(m)} mins` : `${m} mins`;
};

/**
 * Safely parses the raw course object from the database into a structured syllabus array.
 * Extracts sections and lessons, falling back to safe defaults if nested data is missing or malformed.
 * @param {Object} course - The raw course data from the backend.
 * @returns {Array} An array of formatted section objects containing lessons.
 */
const buildSyllabus = (course) => {
    if (Array.isArray(course?.sections) && course.sections.length) {
        return course.sections.map((sec, idx) => ({
            title: sec.title || `Section ${idx + 1}`,
            lessons: Array.isArray(sec.lessons)
                ? sec.lessons.map((l) => ({
                    title: l.title || "Lesson",
                    durationMin: Number(l.durationMin) || 0, // Ensure duration is strictly a Number
                    type: l.type || "lesson",                // Identifies if it's a "lesson" (video/doc) or "quiz"
                    locked: !!l.locked,                      // Premium/locked status identifier for future use
                }))
                : [],
        }));
    }
    return []; // Return an empty array to prevent map() errors in the UI rendering phase
};

// ==== Main Component ====

/**
 * CourseDetail Component
 * Public-facing landing page that displays the details of a specific course.
 * Shows the curriculum (syllabus), goals, duration, price, and provides an entry point to enroll.
 */
export default function CourseDetail() {
    // ---- Routing Hooks ----
    const { courseId } = useParams();
    const navigate = useNavigate();

    // ---- Data & Network States ----
    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // ---- UI States ----
    // Tracks the indices of the syllabus sections that are currently expanded in the accordion.
    // Initializes with `[0]` so the first section is expanded by default.
    const [expandedSections, setExpandedSections] = useState([0]);

    // ==== Data Fetching (Stale-While-Revalidate Caching Strategy) ====

    useEffect(() => {
        // Flag to prevent state updates if the component unmounts before the fetch finishes
        let cancelled = false;

        async function fetchCourse() {
            // 1. Define a unique cache key for this specific course using its ID
            const cacheKey = `course_detail_v1_${courseId}`;
            const cached = sessionStorage.getItem(cacheKey);

            // 2. Cache-First Rendering: If cache exists, show it immediately (0s loading time)
            if (cached) {
                setCourse(JSON.parse(cached));
                setLoading(false);
            } else {
                // Only show the loading skeleton if we have absolutely no data
                setLoading(true);
            }
            setError("");

            try {
                // 3. Fetch fresh data from the backend to ensure accuracy (e.g., price changes, new lessons)
                const res = await fetch(toAbsolute(`/api/courses/public/${courseId}`));

                if (!res.ok) {
                    if (res.status === 404) {
                        if (!cancelled) {
                            setCourse(null);
                            setError("not-found");
                        }
                        return;
                    }
                    const body = await res.json().catch(() => ({}));
                    throw new Error(body.message || "Failed to load course");
                }

                const data = await res.json();
                
                // 4. Silently update the state and the cache with the fresh data
                if (!cancelled) {
                    setCourse(data);
                    sessionStorage.setItem(cacheKey, JSON.stringify(data));
                    setLoading(false);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err.message || "Failed to load course");
                    setLoading(false);
                }
            }
        }

        fetchCourse();

        // Cleanup function to prevent memory leaks and React state errors if the user navigates away quickly
        return () => {
            cancelled = true;
        };
    }, [courseId]);

    // ==== Derived Data Calculations ====

    const syllabus = buildSyllabus(course || {});

    // IIFE (Immediately Invoked Function Expression) to calculate overall curriculum statistics
    // Aggregates total sections, total lessons, and computes the total duration text.
    const totals = (() => {
        let sections = syllabus.length;
        let lessons = 0;
        let totalMins = 0;
        syllabus.forEach((s) => {
            lessons += s.lessons.length;
            s.lessons.forEach((l) => (totalMins += l.durationMin));
        });
        return { sections, lessons, minsText: minutesToText(totalMins) };
    })();

    // Determine if the course is free based on the priceUSD field
    const isFree = !course?.priceUSD || Number(course?.priceUSD) === 0;

    // ==== Accordion Handlers ====

    // Checks if all available sections are currently expanded
    const isAllExpanded = syllabus.length > 0 && expandedSections.length === syllabus.length;

    /** Toggles the expansion state of all accordion sections simultaneously. */
    const toggleExpandAll = () => {
        if (isAllExpanded) {
            setExpandedSections([]); // Collapse all
        } else {
            setExpandedSections(syllabus.map((_, i) => i)); // Expand all by storing all indices
        }
    };

    /** Toggles the expansion state of a specific individual section. */
    const toggleSection = (idx) => {
        setExpandedSections((prev) =>
            prev.includes(idx)
                ? prev.filter((i) => i !== idx) // Remove index if it's already open (collapse)
                : [...prev, idx]                // Add index if it's closed (expand)
        );
    };

    // ==== Loading & Error Views ====

    /**
     * Skeleton Component: Mimics the exact layout of the Course Detail page.
     * Prevents Cumulative Layout Shift (CLS) by reserving the exact space the real content will occupy.
     */
    const SkeletonDetail = () => (
        <section className="detail-grid">
            <div className="detail-left">
                <div className="skeleton skeleton-title-lg"></div>
                <div className="skeleton skeleton-text" style={{ width: '90%' }}></div>
                <div className="skeleton skeleton-text" style={{ width: '60%', marginBottom: '24px' }}></div>
                
                <div className="learn-block">
                    <div className="skeleton skeleton-text" style={{ width: '30%', height: '24px', marginBottom: '16px' }}></div>
                    <div className="learn-grid">
                        {[...Array(4)].map((_, i) => <div key={i} className="skeleton skeleton-text" style={{ width: '90%' }}></div>)}
                    </div>
                </div>

                <div className="curriculum-block" style={{ marginTop: '24px' }}>
                    <div className="skeleton skeleton-text" style={{ width: '40%', height: '24px', marginBottom: '16px' }}></div>
                    {[...Array(3)].map((_, i) => <div key={i} className="skeleton skeleton-acc-head"></div>)}
                </div>
            </div>
            <aside className="detail-right">
                <div className="right-card">
                    <div className="skeleton skeleton-thumb"></div>
                    <div className="skeleton skeleton-text" style={{ width: '40%', height: '28px', margin: '12px 0' }}></div>
                    <div className="skeleton skeleton-btn-lg"></div>
                    <div className="right-facts" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[...Array(4)].map((_, i) => <div key={i} className="skeleton skeleton-text" style={{ width: '80%' }}></div>)}
                    </div>
                </div>
            </aside>
        </section>
    );

    // Initial loading state (No cache available yet)
    if (loading && !course) {
        return (
            <div className="course-detail-page">
                <SiteHeader />
                <main className="course-detail course-container">
                    <nav className="breadcrumb">
                        <span className="skeleton skeleton-text" style={{ width: '60px', marginBottom: 0 }}></span>
                        <span>›</span>
                        <span className="skeleton skeleton-text" style={{ width: '120px', marginBottom: 0 }}></span>
                    </nav>
                    <SkeletonDetail />
                </main>
                <SiteFooter />
            </div>
        );
    }

    // Handle 404 Not Found error
    if (error === "not-found" || (!course && !loading)) {
        return (
            <div className="course-detail-page">
                <SiteHeader />
                <div className="course-detail course-container">
                    <p>Course not found.</p>
                    <button className="ghost-btn" onClick={() => navigate("/courses")}>
                        ← Back to Courses
                    </button>
                </div>
                <SiteFooter />
            </div>
        );
    }

    // Handle standard network or server errors
    if (error && !course) {
        return (
            <div className="course-detail-page">
                <SiteHeader />
                <div className="course-detail course-container">
                    <p style={{ color: "#FA5252" }}>Error: {error}</p>
                    <button className="ghost-btn" onClick={() => navigate("/courses")}>
                        ← Back to Courses
                    </button>
                </div>
                <SiteFooter />
            </div>
        );
    }

    // ==== Render Actual Content ====

    return (
        <div className="course-detail-page">
            <SiteHeader />

            <main className="course-detail course-container">
                {/* ---- Breadcrumb Navigation ---- */}
                <nav className="breadcrumb">
                    <Link to="/courses">Courses</Link>
                    <span>›</span>
                    <span>{course.title}</span>
                </nav>

                <section className="detail-grid">
                    {/* ==== Left Column: Main Description & Curriculum ==== */}
                    <div className="detail-left">
                        <h1 className="dc-title">{course.title}</h1>

                        {course.description && (
                            <p className="dc-subtitle">{course.description}</p>
                        )}

                        {/* ---- "What you'll learn" Goals Section ---- */}
                        <div className="learn-block">
                            <h3>What you’ll learn</h3>
                            <div className="learn-grid">
                                {/* Use provided goals or fallback to default placeholder goals */}
                                {(course.learn && course.learn.length > 0 ? course.learn : [
                                    "Core foundations of the subject",
                                    "Essential terms and key concepts",
                                    "Basic models and architectures",
                                    "Better intuition for problem solving",
                                ]).map((t, i) => (
                                    <div className="learn-item" key={i}>
                                        <span className="tick">✓</span>
                                        <span>{t}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* ---- Curriculum Accordion Section ---- */}
                        <div className="curriculum-block">
                            <div className="curriculum-head">
                                <h3>Course content</h3>
                                <div className="cur-stats">
                                    {totals.sections} sections •{" "}
                                    {totals.lessons} lessons •{" "}
                                    {totals.minsText}
                                </div>
                                <button
                                    className="link-btn"
                                    onClick={toggleExpandAll}
                                >
                                    {isAllExpanded ? "Collapse all" : "Expand all"}
                                </button>
                            </div>

                            <div className="accordion">
                                {syllabus.map((sec, idx) => {
                                    // Check if this specific section's index exists in the expanded state array
                                    const opened = expandedSections.includes(idx);
                                    return (
                                        <div className="acc-section" key={idx}>
                                            <button 
                                                className={`acc-head ${opened ? "open" : ""}`} 
                                                onClick={() => toggleSection(idx)}
                                            >
                                                <span className="acc-sign">{opened ? "−" : "+"}</span>
                                                <span className="acc-title">{sec.title}</span>
                                                <span className="acc-count">{sec.lessons.length} lessons</span>
                                            </button>

                                            {/* Render the lessons list only if the section is open */}
                                            {opened && (
                                                <ul className="acc-list">
                                                    {sec.lessons.map((l, i) => (
                                                        <li className="acc-row" key={i}>
                                                            {/* Dynamically render icon and color based on lesson type (quiz vs lesson) */}
                                                            <i
                                                                className={`bi ${l.type === "quiz" ? "bi-question-circle-fill" : "bi-play-circle-fill"}`}
                                                                aria-hidden="true"
                                                                style={{ color: l.type === 'quiz' ? '#ff7a00' : 'var(--primary)', fontSize: '18px' }}
                                                            />
                                                            <span className="acc-lesson">{l.title}</span>
                                                            <span className="acc-duration" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                                                {l.durationMin > 0 ? `${l.durationMin} mins` : "—"}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ==== Right Column: Sticky Sidebar ==== */}
                    <aside className="detail-right">
                        <div className="right-card">
                            {/* Course Cover Image */}
                            <div className="right-thumb">
                                <img
                                    src={course.coverUrl || "/img/course-placeholder.jpg"}
                                    alt={course.title}
                                    style={{ objectFit: "cover" }}
                                />
                            </div>

                            {/* Pricing Display */}
                            <div className="right-price">
                                {isFree ? (
                                    <span className="price-free">Free</span>
                                ) : (
                                    <span className="price-paid">${course.priceUSD}</span>
                                )}
                            </div>

                            {/* Main Call to Action */}
                            <button
                                className="enroll-btn"
                                onClick={() => navigate(`/courses/${courseId}/learn`)}
                            >
                                Enroll
                            </button>

                            {/* Key Facts / Metadata List */}
                            <ul className="right-facts">
                                <li>
                                    <i className="bi bi-mortarboard-fill rf-ico" aria-hidden="true"></i>
                                    Grade: <strong>
                                        {course.grade ? (isNaN(course.grade) ? course.grade : `${course.grade}`) : "All grades"}
                                    </strong>
                                </li>
                                <li>
                                    <i className="bi bi-book-fill rf-ico" aria-hidden="true"></i>
                                    Lessons: <strong>{totals.lessons}</strong>
                                </li>
                                <li>
                                    <i className="bi bi-alarm-fill rf-ico" aria-hidden="true"></i>
                                    Duration: <strong>{totals.minsText}</strong>
                                </li>
                                <li>
                                    <i className="bi bi-globe2 rf-ico" aria-hidden="true"></i>
                                    Access: <strong>Anytime, anywhere</strong>
                                </li>
                            </ul>
                        </div>
                    </aside>
                </section>
            </main>

            <SiteFooter />
        </div>
    );
}