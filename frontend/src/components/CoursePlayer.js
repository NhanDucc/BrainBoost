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

  // UI Ask AI
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

  // ==== AI slides state ====
  const [aiSlides, setAiSlides] = useState([]); // [{title, bullets:[]}, ...]
  const [aiSlidesLoading, setAiSlidesLoading] = useState(false);
  const [aiSlidesError, setAiSlidesError] = useState("");
  const [activeSlide, setActiveSlide] = useState(0);
  const lastSlidesLessonKeyRef = useRef(null);

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

  // Load course
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
  const lessonUseOriginal =
    currentLesson && typeof currentLesson.useOriginalDoc === "boolean"
      ? currentLesson.useOriginalDoc
      : lessonHasFile;
  const lessonUseAiSlides =
    currentLesson && typeof currentLesson.useAiSlides === "boolean"
      ? currentLesson.useAiSlides
      : false;

  // Reset khi đổi bài học
  useEffect(() => {
    setViewMode("original");
    setAiSlides([]);
    setAiSlidesError("");
    setActiveSlide(0);
    setTtsText("");
    stopTts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSec, activeLesson, courseId]);

  // Đảm bảo viewMode hợp lệ với lựa chọn của giáo viên
  useEffect(() => {
    if (!currentLesson) return;

    if (viewMode === "original" && !lessonUseOriginal && lessonUseAiSlides) {
      setViewMode("ai");
    } else if (
      viewMode === "ai" &&
      (!lessonUseAiSlides || !lessonHasFile) &&
      lessonUseOriginal
    ) {
      setViewMode("original");
    }
  }, [
    viewMode,
    lessonUseOriginal,
    lessonUseAiSlides,
    lessonHasFile,
    currentLesson,
  ]);

  // ===== TTS =====
  const loadLessonText = async () => {
    if (!currentLesson || !currentLesson.contentUrl) {
      alert("No document to read.");
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

      // Các loại khác → gọi backend
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
    if (!currentLesson || !currentLesson.contentUrl) return;

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

  // ===== AI slides (gọi API Gemini ở backend) =====
  const ensureAiSlidesLoaded = async () => {
    if (!currentLesson || !currentLesson.contentUrl) return;

    const { full } = getUrlParts(currentLesson.contentUrl);
    if (!full) return;

    const lessonKey = `${courseId}-${activeSec}-${activeLesson}-${full}`;
    lastSlidesLessonKeyRef.current = lessonKey;

    setAiSlidesLoading(true);
    setAiSlidesError("");

    try {
      const res = await fetch(toAbsolute("/api/tts/gen-slides"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          url: full,
          lessonTitle: currentLesson.title || "Lesson",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.message || `Slide generation failed (HTTP ${res.status}).`
        );
      }

      const slides = Array.isArray(data.slides) ? data.slides : [];
      if (!slides.length) {
        throw new Error("AI did not return any slides.");
      }

      if (lastSlidesLessonKeyRef.current !== lessonKey) return;

      setAiSlides(slides);
      setActiveSlide(0);
    } catch (e) {
      console.error("[AI slides] error:", e);
      if (lastSlidesLessonKeyRef.current === lessonKey) {
        setAiSlidesError(e.message || "Cannot generate slides for this lesson.");
      }
    } finally {
      if (lastSlidesLessonKeyRef.current === lessonKey) {
        setAiSlidesLoading(false);
      }
    }
  };

  // ===== Viewers =====
  const renderDocViewer = () => {
    if (!currentLesson || !currentLesson.contentUrl) {
      return (
        <div className="doc-empty">
          <p>No document uploaded for this lesson yet.</p>
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
    if (!currentLesson || !currentLesson.contentUrl) {
      return (
        <div className="doc-empty">
          <p>No document to generate AI slides from.</p>
        </div>
      );
    }

    if (aiSlidesLoading) {
      return (
        <div className="doc-empty">
          <p>Generating AI slides for this lesson…</p>
        </div>
      );
    }

    if (aiSlidesError) {
      return (
        <div className="doc-empty">
          <p>{aiSlidesError}</p>
        </div>
      );
    }

    if (!aiSlides.length) {
      return (
        <div className="doc-empty">
          <p>
            Click on <strong>AI slides (beta)</strong> again if nothing appears,
            or ask your teacher to enable AI slides for this lesson.
          </p>
        </div>
      );
    }

    const slide = aiSlides[activeSlide] || {};
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
            slide.body && <p className="ai-slide-body">{slide.body}</p>
          )}
        </div>

        <div className="ai-slide-footer">
          <button
            type="button"
            className="btn-outline"
            onClick={() => setActiveSlide((s) => Math.max(0, s - 1))}
            disabled={activeSlide === 0}
          >
            ◀ Prev
          </button>
          <span className="ai-slide-index">
            {activeSlide + 1} / {aiSlides.length}
          </span>
          <button
            type="button"
            className="btn-outline"
            onClick={() =>
              setActiveSlide((s) => Math.min(aiSlides.length - 1, s + 1))
            }
            disabled={activeSlide >= aiSlides.length - 1}
          >
            Next ▶
          </button>
        </div>
      </div>
    );
  };

  const renderActiveView = () => {
    if (!lessonHasFile) {
      return (
        <div className="doc-empty">
          <p>No document uploaded for this lesson yet.</p>
        </div>
      );
    }

    if (viewMode === "ai" && lessonUseAiSlides) {
      return renderAiSlides();
    }

    if (lessonUseOriginal) {
      return renderDocViewer();
    }

    return (
      <div className="doc-empty">
        <p>This lesson does not have any document or AI slide view enabled.</p>
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
      : "Press Play to listen to this lesson.";

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
                disabled={!lessonUseOriginal || !lessonHasFile}
              >
                Original document
              </button>
              <button
                type="button"
                className={`view-toggle-btn ${
                  viewMode === "ai" ? "active" : ""
                }`}
                onClick={() => {
                  setViewMode("ai");
                  if (!aiSlides.length && !aiSlidesLoading && lessonUseAiSlides) {
                    ensureAiSlidesLoaded();
                  }
                }}
                disabled={!lessonUseAiSlides || !lessonHasFile}
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
                disabled={ttsStatus === "loading" || !lessonHasFile}
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
