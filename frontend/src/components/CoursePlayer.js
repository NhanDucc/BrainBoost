import React, { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { toAbsolute } from "../utils/url";
import "../css/CoursePlayer.css";

// Get sections/lessons from the course.
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

  const stopTts = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setTtsStatus("idle");
  };

  // Stop TTS when leaving the page
  useEffect(() => {
    return () => {
      stopTts();
    };
  }, []);

  // ==== Load course public ====
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

  // ==== State displaying error / loading ====
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

  // ==== Main render of course player ====
  const syllabus = buildSyllabus(course);
  const currentSection = syllabus[activeSec] || { lessons: [] };
  const currentLesson = currentSection.lessons[activeLesson] || null;

  // ==== Helper: extracts the URL to only get the path portion for extension testing ====
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

  // ==== Load the lesson text for TTS ====
  const loadLessonText = async () => {
    if (!currentLesson || !currentLesson.contentUrl) {
      alert("No document to read.");
      return "";
    }

    // If you are speaking/paused, reuse the existing text.
    if (ttsStatus === "speaking" || ttsStatus === "paused") {
      return ttsText;
    }

    setTtsStatus("loading");

    try {
      const { full, forExt } = getUrlParts(currentLesson.contentUrl);
      if (!full) {
        throw new Error("Lesson has no document URL.");
      }

      const lower = forExt.toLowerCase();

      // 1) If it's a .txt file, read it directly on the client (while still retaining the query/token).
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

      // 2) ANY OTHER FILE TYPE → delegate to backend /api/tts/extract
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
      if (err && err.stack) {
        console.error(err.stack);
      }

      setTtsStatus("idle");
      alert(err.message || "Cannot read text from this document for TTS yet.");
      return "";
    }
  };

  // ==== Handle Play / Pause TTS ====
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
    u.lang = "en-US"; // Change to "vi-VN" if the article is in Vietnamese.
    u.rate = 1.0;
    u.onend = () => setTtsStatus("ready");
    u.onerror = () => setTtsStatus("ready");

    utteranceRef.current = u;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setTtsStatus("speaking");
  };

  // ==== render doc viewer ====
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

    // 1) PDF: use Google Docs Viewer
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

    // 2) Word / PowerPoint: use Office Web Viewer
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

    // 3) Fallback: Google Docs Viewer (cho txt, v.v.)
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

  // ==== Handle sending demo chat message ====
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

  // ==== Text displayed in the audio bar ====
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
          {/* Left column: List of articles */}
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
                      setTtsText("");
                      stopTts();
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
                            setTtsText("");
                            stopTts();
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
            {/* doc/pdf frame */}
            <div className="doc-container">{renderDocViewer()}</div>

            {/* audio bar – now shows audio status */}
            <div className="audio-bar">
              <span className="audio-label">{audioStatusText}</span>
            </div>

            {/* control button */}
            <div className="controls-row">
              <button
                type="button"
                className="btn-primary"
                onClick={handlePlayPause}
                disabled={ttsStatus === "loading"}
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

      {/* ==== AI Assistant ==== */}
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