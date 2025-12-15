import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { toAbsolute } from "../utils/url";
import "../css/CoursePlayer.css";

/** Lấy sections/lessons từ course */
const buildSyllabus = (course) => {
    if (Array.isArray(course?.sections) && course.sections.length) {
        return course.sections.map((sec, idx) => ({
        title: sec.title || `Section ${idx + 1}`,
        lessons: Array.isArray(sec.lessons) ? sec.lessons : [],
        }));
    }
    return [];
};

export default function CoursePlayer() {
    const { courseId } = useParams();
    const navigate = useNavigate();

    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [activeSec, setActiveSec] = useState(0);
    const [activeLesson, setActiveLesson] = useState(0);

    // UI Ask AI
    const [showChat, setShowChat] = useState(false);
    const [chatMessages, setChatMessages] = useState([
        {
        from: "ai",
        text: "Hi, I'm BrainBoost Assistant. This is a demo chat UI – later we will connect real AI to explain your lessons.",
        },
    ]);
    const [chatInput, setChatInput] = useState("");

    // Load course public
    useEffect(() => {
        let cancelled = false;

        async function fetchCourse() {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(toAbsolute(`/api/courses/public/${courseId}`));
            if (!res.ok) {
            if (res.status === 404) {
                if (!cancelled) {
                setError("not-found");
                setCourse(null);
                }
                return;
            }
            const body = await res.json().catch(() => ({}));
            throw new Error(body.message || "Failed to load course");
            }
            const data = await res.json();
            if (!cancelled) {
            setCourse(data);
            }
        } catch (e) {
            if (!cancelled) {
            setError(e.message || "Failed to load course");
            }
        } finally {
            if (!cancelled) setLoading(false);
        }
        }

        fetchCourse();
        return () => {
        cancelled = true;
        };
    }, [courseId]);

    // ====== state hiển thị lỗi / loading ======
    if (loading) {
        return (
        <div className="learning-page">
            <SiteHeader />
            <main className="learning-container">
            <p>Loading course content…</p>
            </main>
            <SiteFooter />
        </div>
        );
    }

    if (error === "not-found" || (!course && !loading)) {
        return (
        <div className="learning-page">
            <SiteHeader />
            <main className="learning-container">
            <p>Course not found.</p>
            <button className="btn-secondary" onClick={() => navigate("/courses")}>
                ← Back to Courses
            </button>
            </main>
            <SiteFooter />
        </div>
        );
    }

    if (error && !course) {
        return (
        <div className="learning-page">
            <SiteHeader />
            <main className="learning-container">
            <p className="error-text">Error: {error}</p>
            <button className="btn-secondary" onClick={() => navigate("/courses")}>
                ← Back to Courses
            </button>
            </main>
            <SiteFooter />
        </div>
        );
    }

    // ====== từ đây chắc chắn có course ======
    const syllabus = buildSyllabus(course);
    const currentSection = syllabus[activeSec] || { lessons: [] };
    const currentLesson = currentSection.lessons[activeLesson] || null;

    // ----- render doc viewer -----
    const renderDocViewer = () => {
        if (!currentLesson || !currentLesson.contentUrl) {
            return (
            <div className="doc-empty">
                <p>No document uploaded for this lesson yet.</p>
            </div>
            );
        }

        const url = currentLesson.contentUrl.trim();
        if (!url) {
            return (
            <div className="doc-empty">
                <p>No document uploaded for this lesson yet.</p>
            </div>
            );
        }

        // Bỏ query string (nếu Cloudinary có ?v=123&...)
        const base = url.split("?")[0];
        const lower = base.toLowerCase();

        const isPdf = lower.endsWith(".pdf");

        // Nếu là PDF → nhúng trực tiếp, cho phép scroll
        if (isPdf) {
            return (
            <iframe
                src={base + "#view=FitH"} // có thể bỏ #view=FitH nếu không thích
                title={currentLesson.title || "Lesson document"}
                className="doc-frame"
            />
            );
        }

        // Các loại doc/docx/txt → dùng Google Docs Viewer
        const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(
            base
        )}&embedded=true`;

        return (
            <iframe
            src={viewerUrl}
            title={currentLesson.title || "Lesson document"}
            className="doc-frame"
            />
        );
    };

    // ----- xử lý gửi tin nhắn demo -----
    const handleSendChat = (e) => {
        e.preventDefault();
        const text = chatInput.trim();
        if (!text) return;
        setChatMessages((prev) => [
        ...prev,
        { from: "user", text },
        {
            from: "ai",
            text:
            "(Demo) Later the AI will answer based on this lesson. For now this is just a placeholder response.",
        },
        ]);
        setChatInput("");
    };

    return (
        <div className="learning-page">
        <SiteHeader />

        <main className="learning-container">
            {/* breadcrumb */}
            <nav className="breadcrumb">
            <Link to="/courses">Courses</Link>
            <span>›</span>
            <Link to={`/courses/${courseId}`}>{course.title}</Link>
            <span>›</span>
            <span>Learn</span>
            </nav>

            <div className="learning-layout">
            {/* Cột bên trái: danh sách bài */}
            <aside className="learning-sidebar">
                <h2 className="course-title">{course.title}</h2>
                <p className="course-sub">
                Choose a lesson. The document will appear on the right.
                </p>

                <div className="section-list">
                {syllabus.map((sec, si) => (
                    <div key={si} className="section-block">
                    <button
                        className={`section-header ${
                        si === activeSec ? "active" : ""
                        }`}
                        onClick={() => {
                        setActiveSec(si);
                        setActiveLesson(0);
                        }}
                    >
                        <span className="section-index">{si + 1}.</span>
                        <span>{sec.title}</span>
                    </button>

                    {si === activeSec && (
                        <ul className="lesson-list">
                        {sec.lessons.map((l, li) => (
                            <li
                            key={li}
                            className={`lesson-item ${
                                li === activeLesson ? "lesson-active" : ""
                            }`}
                            onClick={() => setActiveLesson(li)}
                            >
                            {li + 1}. {l.title || "Untitled lesson"}
                            </li>
                        ))}
                        </ul>
                    )}
                    </div>
                ))}
                </div>
            </aside>

            {/* Khu vực học tập chính */}
            <section className="learning-main">
                {/* khung doc/pdf */}
                <div className="doc-container">{renderDocViewer()}</div>

                {/* thanh audio placeholder */}
                <div className="audio-bar">
                <span className="audio-label">
                    Audio track for this lesson (coming soon)
                </span>
                </div>

                {/* nút điều khiển */}
                <div className="controls-row">
                <button
                    type="button"
                    className="btn-primary"
                    // sau này sẽ nối với audioRef
                >
                    Play / Pause
                </button>
                <button
                    type="button"
                    className="btn-outline"
                    onClick={() => setShowChat(true)}
                >
                    Ask AI
                </button>
                </div>
            </section>
            </div>
        </main>

        <SiteFooter />

        {/* ====== Hộp thoại AI Assistant ====== */}
        {showChat && (
            <div
            className="ai-modal-backdrop"
            onClick={(e) => {
                if (e.target.classList.contains("ai-modal-backdrop")) {
                setShowChat(false);
                }
            }}
            >
            <div className="ai-modal">
                <header className="ai-modal-header">
                <h3>AI Assistant</h3>
                <button
                    type="button"
                    className="ai-close-btn"
                    onClick={() => setShowChat(false)}
                >
                    ✕
                </button>
                </header>

                <div className="ai-modal-body">
                {chatMessages.map((m, idx) => (
                    <div
                    key={idx}
                    className={`ai-msg ai-msg-${m.from === "user" ? "user" : "ai"}`}
                    >
                    <div className="ai-msg-bubble">{m.text}</div>
                    </div>
                ))}
                </div>

                <form className="ai-input-row" onSubmit={handleSendChat}>
                <input
                    type="text"
                    placeholder="Ask about this lesson..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                />
                <button type="submit" className="btn-primary">
                    Send
                </button>
                </form>
            </div>
            </div>
        )}
        </div>
    );
}
