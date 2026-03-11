import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toAbsolute } from "../utils/url";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import "../css/CourseDetail.css";

// ==== Helper Functions ====

/**
 * Converts a total number of minutes into a human-readable string.
 * Example: 90 -> "01 hrs 30 mins", 45 -> "45 mins"
 * @param {Number} mins - Total duration in minutes.
 * @returns {String} Formatted time string.
 */
const minutesToText = (mins) => {
    if (!mins || isNaN(mins) || mins === 0) return "0 mins";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
    return h > 0 ? `${pad(h)} hrs ${pad(m)} mins` : `${m} mins`;
};

/**
 * Safely parses the raw course object from the database into a structured syllabus array.
 * Extracts sections and lessons, falling back to safe defaults if data is missing.
 * @param {Object} course - The raw course data from the backend.
 * @returns {Array} An array of formatted section objects.
 */
const buildSyllabus = (course) => {
    if (Array.isArray(course?.sections) && course.sections.length) {
        return course.sections.map((sec, idx) => ({
            title: sec.title || `Section ${idx + 1}`,
            lessons: Array.isArray(sec.lessons)
                ? sec.lessons.map((l) => ({
                    title: l.title || "Lesson",
                    durationMin: Number(l.durationMin) || 0, // Ensure duration is parsed as a Number
                    type: l.type || "lesson",                // Identifies if it's a "lesson" or "quiz"
                    locked: !!l.locked,                      // Premium/locked status (if applicable)
                }))
                : [],
        }));
    }
    return []; // Return an empty array to prevent map() errors in the UI
};

// ==== Main Component ====

/**
 * CourseDetail Component
 * Public-facing page that displays the landing/preview information of a course.
 * Shows the curriculum, duration, price, and allows the student to enroll.
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
    const [expandedSections, setExpandedSections] = useState([0]);

    // ==== Data Fetching ====

    useEffect(() => {
        // Used to prevent state updates if the component unmounts
        let cancelled = false;

        async function fetchCourse() {
            setLoading(true);
            setError("");

            try {
                // Fetch public course details from the backend
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
                if (!cancelled) setCourse(data);
            } catch (err) {
                if (!cancelled) setError(err.message || "Failed to load course");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchCourse();

        // Cleanup function to prevent memory leaks
        return () => {
            cancelled = true;
        };
    }, [courseId]);

    // ==== Loading & Errors

    if (loading) {
        return (
            <div className="course-detail-page">
                <SiteHeader />
                <main className="course-detail course-container">
                    <p>Loading course...</p>
                </main>
                <SiteFooter />
            </div>
        );
    }

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

    if (error && !course) {
        return (
            <div className="course-detail-page">
                <SiteHeader />
                <div className="course-detail course-container">
                    <p style={{ color: "#FA5252" }}>
                        Error: {error}
                    </p>
                    <button className="ghost-btn" onClick={() => navigate("/courses")}>
                        ← Back to Courses
                    </button>
                </div>
                <SiteFooter />
            </div>
        );
    }

    // ==== Derived Data Calculations ====

    const syllabus = buildSyllabus(course || {});

    // IIFE to calculate overall curriculum statistics (total sections, lessons, and duration)
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

    // Check if the course is completely free
    const isFree = !course.priceUSD || Number(course.priceUSD) === 0;

    // ==== Accordion Handlers ====

    // Check if the number of expanded sections matches the total number of sections
    const isAllExpanded = syllabus.length > 0 && expandedSections.length === syllabus.length;

    /**
     * Toggles the state of all sections simultaneously.
     * If all are open, it collapses them. Otherwise, it expands all of them.
     */
    const toggleExpandAll = () => {
        if (isAllExpanded) {
            setExpandedSections([]); // Collapse all by emptying the array
        } else {
            setExpandedSections(syllabus.map((_, i) => i)); // Expand all by storing every index
        }
    };

    /**
     * Toggles the expanded/collapsed state of a single specific section.
     * @param {Number} idx - The index of the section being toggled.
     */
    const toggleSection = (idx) => {
        setExpandedSections((prev) =>
            prev.includes(idx)
                ? prev.filter((i) => i !== idx)     // If currently open, remove it from the array (collapse)
                : [...prev, idx]                    // If currently closed, add it to the array (expand)
        );
    };

    // ==== Render ====

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
                    {/* ==== Left Column: Main Content ==== */}
                    <div className="detail-left">
                        <h1 className="dc-title">{course.title}</h1>

                        {course.description && (
                            <p className="dc-subtitle">{course.description}</p>
                        )}

                        {/* ---- What you'll learn Section ---- */}
                        <div className="learn-block">
                            <h3>What you’ll learn</h3>
                            <div className="learn-grid">
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

                        {/* ---- Curriculum / Accordion Section ---- */}
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
                                    // Check if this specific section is in the expanded state array
                                    const opened = expandedSections.includes(idx); // Kiểm tra xem section có trong mảng mở không
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

                                            {opened && (
                                                <ul className="acc-list">
                                                    {sec.lessons.map((l, i) => (
                                                        <li className="acc-row" key={i}>
                                                            {/* HIỂN THỊ ĐÚNG ICON VÀ MÀU DỰA VÀO TYPE */}
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
                            <div className="right-thumb">
                                <img
                                    src={course.coverUrl || "/img/course-placeholder.jpg"}
                                    alt={course.title}
                                    style={{ objectFit: "cover" }}
                                />
                            </div>

                            <div className="right-price">
                                {isFree ? (
                                    <span className="price-free">Free</span>
                                ) : (
                                    <span className="price-paid">${course.priceUSD}</span>
                                )}
                            </div>

                            <button
                                className="enroll-btn"
                                onClick={() => navigate(`/courses/${courseId}/learn`)}
                            >
                                Enroll
                            </button>

                            <ul className="right-facts">
                                <li>
                                    <i className="bi bi-trophy-fill rf-ico" aria-hidden="true"></i>
                                    Level: <strong>{course.grade || "All levels"}</strong>
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