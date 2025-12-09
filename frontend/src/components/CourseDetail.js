import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toAbsolute } from "../utils/url";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import "../css/CourseDetail.css";

/* ---------- helpers ---------- */
const mmssToMinutes = (s) => {
    // "11:35" => 12 (round seconds up to the next minute)
    if (!s || typeof s !== "string") return 0;
    const [m = "0", sec = "0"] = s.split(":");
    const mi = parseInt(m, 10) || 0;
    const se = parseInt(sec, 10) || 0;
    return mi + (se > 0 ? 1 : 0);
};

const minutesToText = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
    return h ? `${pad(h)} hrs ${pad(m)} mins` : `${m} mins`;
};

/** Build syllabus từ dữ liệu thật trong course.
 *  Nếu không có sections thì fallback sang syllabus mock như cũ.
 *  Output: [{ title, lessons: [{ title, duration, type, locked }] }]
 */
const buildSyllabus = (course) => {
    // Ưu tiên dùng sections lưu trong MongoDB
    if (Array.isArray(course?.sections) && course.sections.length) {
        return course.sections.map((sec, idx) => ({
        title: sec.title || `Section ${idx + 1}`,
        lessons: Array.isArray(sec.lessons)
            ? sec.lessons.map((l) => ({
                title: l.title || "Lesson",
                duration: l.duration || "",
                type: l.contentType || "video",
                locked: !!l.locked,
            }))
            : [],
        }));
    }

    // Nếu course đã có syllabus sẵn thì dùng luôn
    if (Array.isArray(course?.syllabus) && course.syllabus.length) {
        return course.syllabus;
    }

    // Subject-flavored section names (optional)
    const fallbackBySubject = {
        math: [
        "Core concepts you must know",
        "Problem-solving strategies",
        "Practice sets & quizzes",
        "Exam preparation",
        ],
        physics: [
        "Measurement & kinematics",
        "Forces & energy",
        "Electricity & waves",
        "Exam training",
        ],
        chemistry: [
        "Particles & bonding",
        "Equations & stoichiometry",
        "Organic basics",
        "Exam training",
        ],
        english: [
        "Grammar fundamentals",
        "Reading skills",
        "Writing & speaking",
        "Exam training",
        ],
    };

    const names =
        course?.curriculum?.length >= 3
        ? course.curriculum
        : fallbackBySubject[course?.subject] || [
            "Introduction",
            "Main topics",
            "Practice & review",
            "Final wrap-up",
            ];

    const makeLessons = (n) =>
        Array.from({ length: n }).map((_, i) => ({
        title:
            i === 0
            ? "Lesson 1 – Overview"
            : i === 1
            ? "Lesson 2 – Key ideas"
            : "Downloadable/Notes",
        duration: i === 0 ? "11:35" : i === 1 ? "10:34" : "01:00",
        type: i === 2 ? "doc" : "video",
        locked: i !== 0, // only first is previewable (demo)
        }));

    return names.map((name, idx) => ({
        title: `${idx + 1}. ${name}`,
        lessons: makeLessons(idx === 0 ? 3 : idx === 1 ? 3 : idx === 2 ? 4 : 2),
    }));
};

export default function CourseDetail() {
    const { courseId } = useParams();
    const navigate = useNavigate();

    const [openSection, setOpenSection] = useState(0);
    const [expandAll, setExpandAll] = useState(false);

    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Scroll lên top khi vào trang
    useEffect(() => {
    let cancelled = false;

    async function fetchCourse() {
        setLoading(true);
        setError("");

        try {
        const res = await fetch(
            toAbsolute(`/api/courses/public/${courseId}`)
        );

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
    return () => {
        cancelled = true;
    };
    }, [courseId]);

    /* ---------- states: loading / error / not-found ---------- */
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
            <p style={{ color: "#FA5252" /* Error color */ }}>
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

    // Từ đây trở xuống chắc chắn đã có course
    const syllabus = buildSyllabus(course || {});

    // totals
    const totals = (() => {
        let sections = syllabus.length;
        let lessons = 0;
        let mins = 0;
        syllabus.forEach((s) => {
        lessons += s.lessons.length;
        s.lessons.forEach((l) => (mins += mmssToMinutes(l.duration)));
        });
        return { sections, lessons, minsText: minutesToText(mins) };
    })();

    const isFree = !course.priceUSD || Number(course.priceUSD) === 0;

    return (
        <div className="course-detail-page">
        <SiteHeader />

        <main className="course-detail course-container">
            {/* Breadcrumb */}
            <nav className="breadcrumb">
            <Link to="/courses">Courses</Link>
            <span>›</span>
            <span>{course.title}</span>
            </nav>

            {/* Top layout */}
            <section className="detail-grid">
            {/* Left column */}
            <div className="detail-left">
                <h1 className="dc-title">{course.title}</h1>

                {course.description && (
                <p className="dc-subtitle">{course.description}</p>
                )}

                {/* What you'll learn */}
                <div className="learn-block">
                <h3>What you’ll learn</h3>
                <div className="learn-grid">
                    {(course.learn || [
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

                {/* Curriculum / Accordion */}
                <div className="curriculum-block">
                <div className="curriculum-head">
                    <h3>Course content</h3>
                    <div className="cur-stats">
                    <strong>{totals.sections}</strong> sections •{" "}
                    <strong>{totals.lessons}</strong> lessons •{" "}
                    <strong>{totals.minsText}</strong>
                    </div>
                    <button
                    className="link-btn"
                    onClick={() => setExpandAll((v) => !v)}
                    >
                    {expandAll ? "Collapse all" : "Expand all"}
                    </button>
                </div>

                <div className="accordion">
                    {syllabus.map((sec, idx) => {
                    const opened = expandAll || openSection === idx;
                    return (
                        <div className="acc-section" key={idx}>
                        <button
                            className={`acc-head ${opened ? "open" : ""}`}
                            onClick={() =>
                            setOpenSection((p) => (p === idx ? -1 : idx))
                            }
                        >
                            <span className="acc-sign">
                            {opened ? "−" : "+"}
                            </span>
                            <span className="acc-title">{sec.title}</span>
                            <span className="acc-count">
                            {sec.lessons.length} lessons
                            </span>
                        </button>

                        {opened && (
                            <ul className="acc-list">
                            {sec.lessons.map((l, i) => (
                                <li className="acc-row" key={i}>
                                <i
                                    className={`bi ${
                                    l.type === "doc"
                                        ? "bi-file-earmark-text-fill icon-doc"
                                        : "bi-play-circle-fill icon-video"
                                    }`}
                                    aria-hidden="true"
                                />
                                <span className="acc-lesson">{l.title}</span>
                                <span className="acc-duration">
                                    {l.duration}
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

            {/* Right column */}
            <aside className="detail-right">
                <div className="right-card">
                <div className="right-thumb">
                    <img
                    src={course.coverUrl || ""}
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
                    <i
                        className="bi bi-trophy-fill rf-ico"
                        aria-hidden="true"
                    ></i>
                    Level: <strong>{course.level || "All levels"}</strong>
                    </li>
                    <li>
                    <i
                        className="bi bi-book-fill rf-ico"
                        aria-hidden="true"
                    ></i>
                    Lessons:{" "}
                    <strong>
                        {course.lessons ||
                        (Array.isArray(course.sections)
                            ? course.sections.reduce(
                                (sum, s) =>
                                sum +
                                (Array.isArray(s.lessons)
                                    ? s.lessons.length
                                    : 0),
                                0
                            )
                            : 0)}
                    </strong>
                    </li>
                    <li>
                    <i
                        className="bi bi-alarm-fill rf-ico"
                        aria-hidden="true"
                    ></i>
                    Duration:{" "}
                    <strong>
                        {course.hours ? `${course.hours} hours` : totals.minsText}
                    </strong>
                    </li>
                    <li>
                    <i
                        className="bi bi-globe2 rf-ico"
                        aria-hidden="true"
                    ></i>
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