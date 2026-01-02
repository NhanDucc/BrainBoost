import React, { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { toAbsolute } from "../utils/url";
import "../css/CoursePlayer.css";

// Build sections/lessons from course
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

  // UI Ask AI (demo)
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      from: "ai",
      text: "Hi, I'm BrainBoost Assistant. This is a demo chat UI – later we will connect real AI to explain your lessons.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");

  // ==== TTS state ====
  // idle | loading | ready | speaking | paused
  const [ttsStatus, setTtsStatus] = useState("idle");
  const [ttsText, setTtsText] = useState("");
  const utteranceRef = useRef(null);

  // ==== View mode ====
  // "original" = file viewer, "ai" = AI slides (beta)
  const [viewMode, setViewMode] = useState("original");

  // ==== AI slides ====
  const [activeSlide, setActiveSlide] = useState(0);

  // ===== Helpers =====
  const stopTts = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setTtsStatus("idle");
  };

  const getUrlParts = (url) => {
    if (!url) return { full: "", forExt: "" };
    const full = url.trim();
    let cutAt = full.length;
    const qIndex = full.indexOf("?");
    const hIndex = full.indexOf("#");
    if (qIndex !== -1 && hIndex !== -1) {
      cutAt = Math.min(qIndex, hIndex);
    } else if (qIndex !== -1) {
      cutAt = qIndex;
    } else if (hIndex !== -1) {
      cutAt = hIndex;
    }
    const forExt = full.slice(0, cutAt);
    return { full, forExt };
  };

  // ===== Hooks =====

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      stopTts();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load course (public)
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
        if (!cancelled) setCourse(data);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load course");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchCourse();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  // ==== Derived values from course/lesson ====
  const syllabus = course ? buildSyllabus(course) : [];
  const currentSection = syllabus[activeSec] || { lessons: [] };
  const currentLesson = currentSection.lessons[activeLesson] || null;

  const lessonHasFile = !!(currentLesson && currentLesson.contentUrl);

  // cho xem tài liệu gốc hay không (schema: showOriginalToStudents)
  const lessonUseOriginal =
    currentLesson && typeof currentLesson.showOriginalToStudents === "boolean"
      ? currentLesson.showOriginalToStudents && lessonHasFile
      : lessonHasFile;

  const hasAiSlides =
    currentLesson &&
    Array.isArray(currentLesson.aiSlides) &&
    currentLesson.aiSlides.length > 0;

  // chỉ bật AI slides nếu giáo viên cho phép + thực sự có slide
  const lessonUseAiSlides =
    currentLesson && currentLesson.useAiSlides && hasAiSlides;

  // Reset khi đổi bài học: chọn view mặc định + reset TTS & slide index
  useEffect(() => {
    if (!currentLesson) {
      setViewMode("original");
    } else if (lessonUseOriginal) {
      setViewMode("original");
    } else if (!lessonUseOriginal && lessonUseAiSlides) {
      setViewMode("ai");
    } else {
      setViewMode("original");
    }
    setActiveSlide(0);
    setTtsText("");
    stopTts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSec, activeLesson, courseId]);

  // ===== TTS (đọc tài liệu gốc) =====
  const loadLessonText = async () => {
    if (!currentLesson || !currentLesson.contentUrl) {
      alert("No document to read.");
      return "";
    }
    if (!lessonUseOriginal) {
      alert("The teacher has disabled the original document for this lesson.");
      return "";
    }

    if (ttsStatus === "speaking" || ttsStatus === "paused") {
      return ttsText;
    }

    setTtsStatus("loading");

    try {
      const { full, forExt } = getUrlParts(currentLesson.contentUrl);
      if (!full) throw new Error("Lesson has no document URL.");

      const lower = forExt.toLowerCase();

      // Plain .txt → đọc trực tiếp
      if (lower.endsWith(".txt")) {
        const res = await fetch(full);
        if (!res.ok) {
          throw new Error(`Cannot load text file (HTTP ${res.status}).`);
        }
        const text = await res.text();
        if (!text.trim()) {
          throw new Error("Text file is empty.");
        }
        setTtsText(text);
        setTtsStatus("ready");
        return text;
      }

      // Các loại khác → gọi backend extract
      const res = await fetch(
        toAbsolute(`/api/tts/extract?url=${encodeURIComponent(full)}`),
        { credentials: "include" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.message || `TTS extract failed (HTTP ${res.status}).`
        );
      }

      const text = data.text || "";
      if (!text.trim()) {
        throw new Error("No readable text returned from server.");
      }

      setTtsText(text);
      setTtsStatus("ready");
      return text;
    } catch (err) {
      console.error("[TTS] loadLessonText failed:", err);
      setTtsStatus("idle");
      alert(err.message || "Cannot read text from this document for TTS yet.");
      return "";
    }
  };

  const handlePlayPause = async () => {
    if (!currentLesson || !currentLesson.contentUrl || !lessonUseOriginal) {
      return;
    }

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Your browser does not support text-to-speech.");
      return;
    }

    if (ttsStatus === "speaking") {
      window.speechSynthesis.pause();
      setTtsStatus("paused");
      return;
    }

    if (ttsStatus === "paused") {
      window.speechSynthesis.resume();
      setTtsStatus("speaking");
      return;
    }

    let text = ttsText;
    if (!text) {
      text = await loadLessonText();
      if (!text) return;
    }

    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; // đổi sang "vi-VN" nếu tài liệu tiếng Việt
    u.rate = 1.0;
    u.onend = () => setTtsStatus("ready");
    u.onerror = () => setTtsStatus("ready");

    utteranceRef.current = u;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setTtsStatus("speaking");
  };

  // ===== Viewers =====
  const renderDocViewer = () => {
    if (!currentLesson || !currentLesson.contentUrl || !lessonUseOriginal) {
      return (
        <div className="doc-empty">
          <p>
            This lesson does not provide the original document to students.  
            If you are the teacher, enable “Show original document” in the editor.
          </p>
        </div>
      );
    }

    const { full, forExt } = getUrlParts(currentLesson.contentUrl);
    if (!full) {
      return (
        <div className="doc-empty">
          <p>No document uploaded for this lesson yet.</p>
        </div>
      );
    }

    const lower = forExt.toLowerCase();
    const isPdf = lower.endsWith(".pdf");
    const isPpt = lower.endsWith(".ppt") || lower.endsWith(".pptx");
    const isDoc = lower.endsWith(".doc") || lower.endsWith(".docx");

    if (isPdf) {
      const pdfViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(
        full
      )}&embedded=true`;

      return (
        <iframe
          src={pdfViewerUrl}
          title={currentLesson.title || "Lesson document"}
          className="doc-frame"
        />
      );
    }

    if (isPpt || isDoc) {
      const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
        full
      )}`;

      return (
        <iframe
          src={officeUrl}
          title={currentLesson.title || "Lesson document"}
          className="doc-frame"
        />
      );
    }

    const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(
      full
    )}&embedded=true`;

    return (
      <iframe
        src={viewerUrl}
        title={currentLesson.title || "Lesson document"}
        className="doc-frame"
      />
    );
  };

  const renderAiSlides = () => {
    const slides =
      currentLesson && Array.isArray(currentLesson.aiSlides)
        ? currentLesson.aiSlides
        : [];

    if (!lessonUseAiSlides) {
      return (
        <div className="doc-empty">
          <p>
            AI slides are not enabled for this lesson.  
            If you are the teacher, tick “Allow BrainBoost to generate AI slides”
            and save the course.
          </p>
        </div>
      );
    }

    if (!slides.length) {
      return (
        <div className="doc-empty">
          <p>
            No AI slides were saved for this lesson.  
            Please regenerate slides in the instructor editor.
          </p>
        </div>
      );
    }

    const safeIndex = Math.min(
      Math.max(activeSlide, 0),
      Math.max(slides.length - 1, 0)
    );
    const slide = slides[safeIndex] || {};
    const bullets = Array.isArray(slide.bullets) ? slide.bullets : [];

    return (
      <div className="ai-slide-container">
        <div className="ai-slide">
          <h2 className="ai-slide-title">{slide.title || "Slide"}</h2>
          {bullets.length > 0 ? (
            <ul className="ai-slide-list">
              {bullets.map((b, idx) => (
                <li key={idx}>{b}</li>
              ))}
            </ul>
          ) : (
            slide.ttsText && (
              <p className="ai-slide-body">{slide.ttsText}</p>
            )
          )}
        </div>

        <div className="ai-slide-footer">
          <button
            type="button"
            className="btn-outline"
            onClick={() => setActiveSlide((s) => Math.max(0, s - 1))}
            disabled={safeIndex === 0}
          >
            ◀ Prev
          </button>
          <span className="ai-slide-index">
            {safeIndex + 1} / {slides.length}
          </span>
          <button
            type="button"
            className="btn-outline"
            onClick={() =>
              setActiveSlide((s) =>
                Math.min(slides.length - 1, s + 1)
              )
            }
            disabled={safeIndex >= slides.length - 1}
          >
            Next ▶
          </button>
        </div>
      </div>
    );
  };

  const renderActiveView = () => {
    if (!currentLesson) {
      return (
        <div className="doc-empty">
          <p>Select a lesson from the left to start learning.</p>
        </div>
      );
    }

    if (!lessonHasFile && !lessonUseAiSlides) {
      return (
        <div className="doc-empty">
          <p>No document or AI slides are available for this lesson yet.</p>
        </div>
      );
    }

    if (viewMode === "ai" && lessonUseAiSlides) {
      return renderAiSlides();
    }

    if (viewMode === "original" && lessonUseOriginal) {
      return renderDocViewer();
    }

    // Fallback: nếu viewMode không hợp lệ, ưu tiên original rồi đến AI
    if (lessonUseOriginal) return renderDocViewer();
    if (lessonUseAiSlides) return renderAiSlides();

    return (
      <div className="doc-empty">
        <p>This lesson does not have any enabled view.</p>
      </div>
    );
  };

  // ===== Chat demo =====
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

  // ===== Audio bar text =====
  const audioStatusText =
    ttsStatus === "loading"
      ? "Preparing audio from this document…"
      : ttsStatus === "speaking"
      ? "Reading aloud – press Pause to stop."
      : ttsStatus === "paused"
      ? "Audio paused – press Resume."
      : ttsStatus === "ready" && ttsText
      ? "Audio ready – press Play to listen again."
      : lessonUseOriginal && lessonHasFile
      ? "Press Play to listen to this lesson."
      : "Audio is only available for the original document view.";

  // ======= EARLY RETURNS (sau tất cả hooks) =======
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

  // ===== Render chính =====
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
          {/* Sidebar: sections/lessons */}
          <aside className="learning-sidebar">
            <h2 className="course-title">{course.title}</h2>
            <p className="course-sub">
              Choose a lesson. The content will appear on the right.
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
                          onClick={() => {
                            setActiveLesson(li);
                          }}
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

          {/* Main learning area */}
          <section className="learning-main">
            {/* View mode toggle */}
            <div className="view-toggle">
              <button
                type="button"
                className={`view-toggle-btn ${
                  viewMode === "original" ? "active" : ""
                }`}
                onClick={() => setViewMode("original")}
                disabled={!lessonUseOriginal}
              >
                Original document
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${
                  viewMode === "ai" ? "active" : ""
                }`}
                onClick={() => setViewMode("ai")}
                disabled={!lessonUseAiSlides}
              >
                AI slides (beta)
              </button>
            </div>

            {/* Document / AI slides frame */}
            <div className="doc-container">{renderActiveView()}</div>

            {/* Audio bar */}
            <div className="audio-bar">
              <span className="audio-label">{audioStatusText}</span>
            </div>

            {/* Controls */}
            <div className="controls-row">
              <button
                type="button"
                className="btn-primary"
                onClick={handlePlayPause}
                disabled={
                  ttsStatus === "loading" || !lessonHasFile || !lessonUseOriginal
                }
              >
                {ttsStatus === "loading"
                  ? "Loading text…"
                  : ttsStatus === "speaking"
                  ? "Pause"
                  : ttsStatus === "paused"
                  ? "Resume"
                  : "Play / Pause"}
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

      {/* ==== AI Assistant modal ==== */}
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
                  className={`ai-msg ai-msg-${
                    m.from === "user" ? "user" : "ai"
                  }`}
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
