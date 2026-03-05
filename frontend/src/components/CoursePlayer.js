import React, { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { api } from "../api";
import "../css/CoursePlayer.css";

// ==== Utility Functions ====

/**
 * Constructs a structured syllabus (sections and lessons) from the raw course data.
 * @param {Object} course - The raw course data from the backend.
 * @returns {Array} Formatted syllabus array.
 */
const buildSyllabus = (course) => {
  if (Array.isArray(course?.sections) && course.sections.length) {
    return course.sections.map((sec, idx) => ({
      title: sec.title || `Section ${idx + 1}`,
      lessons: Array.isArray(sec.lessons) ? sec.lessons : [],
    }));
  }
  return [];
};

/**
 * Compiles text content from AI slides into a single, continuous string 
 * for the Text-to-Speech (TTS) engine to read aloud.
 * @param {Array} slides - Array of AI slide objects.
 * @returns {String} Concatenated string for TTS.
 */
const buildSlidesTts = (slides) => {
  if (!Array.isArray(slides) || !slides.length) return "";

  const pieces = slides
    .map((s, idx) => {
      const title = (s.title || "").toString().trim();
      const bullets = Array.isArray(s.bullets)
        ? s.bullets.map((b) => String(b || "").trim()).filter(Boolean)
        : [];

      // Use explicit TTS text if the instructor provided it
      const explicit = (s.ttsText || "").toString().trim();
      if (explicit) return explicit;

      // Otherwise, build the text from the slide title and bullets
      const parts = [];
      if (title) parts.push(`Slide ${idx + 1}: ${title}`);
      if (bullets.length) parts.push(bullets.join(". "));

      return parts.join(". ");
    })
    .filter(Boolean);

  return pieces.join(". ");
};

/**
 * CoursePlayer Component
 * The main learning interface where students can view documents, interact with AI slides,
 * take personal notes, listen to text-to-speech, and chat with an AI assistant.
 */
export default function CoursePlayer() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  // ==== Course Data State ====
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [activeSec, setActiveSec] = useState(0);
  const [activeLesson, setActiveLesson] = useState(0);

  // ==== Authentication State ====
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // ==== Notes State ====
  const [showNotes, setShowNotes] = useState(false);
  const [lessonNote, setLessonNote] = useState("");

  // ==== AI Chat State ====
  const [chatMessages, setChatMessages] = useState([
    {
      from: "ai",
      text: "Hi, I'm BrainBoost Assistant. Ask me about this lesson and I will answer based on the uploaded content.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // ==== Text-to-Speech (TTS) State ====
  const [ttsStatus, setTtsStatus] = useState("idle");
  const [ttsText, setTtsText] = useState("");
  const utteranceRef = useRef(null);

  // ==== UI View State ====
  const [viewMode, setViewMode] = useState("original");
  const [activeSlide, setActiveSlide] = useState(0);

  /**
   * Cancels any currently playing text-to-speech audio and resets the status.
   */
  const stopTts = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setTtsStatus("idle");
  };

  /**
   * Parses a URL to extract the base path without query parameters or hash fragments.
   * Useful for determining file extensions (e.g., .pdf, .txt).
   */
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

  // ===== Lifecycle Hooks =====

  // Verify user authentication status on mount
  useEffect(() => {
    let cancelled = false;
    async function checkAuth() {
      try {
        const res = await api.get("/users/me");
        if (!cancelled && res.data) setIsLoggedIn(true);
      } catch (err) {
        console.warn("[CoursePlayer] User not logged in");
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    }
    checkAuth();
    return () => { cancelled = true; };
  }, []);

  // Cleanup TTS audio when the component is unmounted
  useEffect(() => {
    return () => stopTts();
  }, []);

  // Fetch course data based on the URL parameter
  useEffect(() => {
    let cancelled = false;
    async function fetchCourse() {
      setLoading(true);
      setError("");
      try {
        const res = await api.get(`/courses/public/${courseId}`);
        if (!cancelled) setCourse(res.data);
      } catch (e) {
        if (!cancelled) {
            if (e.response && e.response.status === 404) {
                setError("not-found");
                setCourse(null);
            } else {
                setError(e.response?.data?.message || "Failed to load course");
            }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchCourse();
    return () => { cancelled = true; };
  }, [courseId]);

  // Derived properties for the current lesson
  const syllabus = course ? buildSyllabus(course) : [];
  const currentSection = syllabus[activeSec] || { lessons: [] };
  const currentLesson = currentSection.lessons[activeLesson] || null;

  const lessonHasFile = !!(currentLesson && currentLesson.contentUrl);
  const lessonUseOriginal = currentLesson && typeof currentLesson.showOriginalToStudents === "boolean"
      ? currentLesson.showOriginalToStudents && lessonHasFile
      : lessonHasFile;

  const hasAiSlides = currentLesson && Array.isArray(currentLesson.aiSlides) && currentLesson.aiSlides.length > 0;
  const lessonUseAiSlides = currentLesson && currentLesson.useAiSlides && hasAiSlides;
  const canPlayAudio = (viewMode === "ai" && lessonUseAiSlides) || (viewMode === "original" && lessonUseOriginal && lessonHasFile);

  // Reset component state when switching lessons & Load saved notes
  useEffect(() => {
    // Determine the optimal default view mode for the newly selected lesson
    if (!currentLesson) setViewMode("original");
    else if (lessonUseOriginal) setViewMode("original");
    else if (!lessonUseOriginal && lessonUseAiSlides) setViewMode("ai");
    else setViewMode("original");

    // Reset interactive states
    setActiveSlide(0);
    setTtsText("");
    stopTts();

    // Load locally saved notes for this specific lesson
    const savedNote = localStorage.getItem(`note_${courseId}_${activeSec}_${activeLesson}`);
    setLessonNote(savedNote || "");

    // Reset the AI chat thread
    setChatMessages([{ from: "ai", text: "Hi, I'm BrainBoost Assistant. Ask me about this lesson and I will answer based on the uploaded content." }]);
    setChatInput("");
    setChatLoading(false);
  }, [activeSec, activeLesson, courseId, currentLesson]);

  // Lesson time tracking algorithm
  useEffect(() => {
    // Do not track if user is not logged in or data is incomplete
    if (!isLoggedIn || !courseId || !currentLesson) return;

    const payload = { lessonKey: `s${activeSec}:l${activeLesson}`, timeSpent: 1 };

    // Initial ping after 10 seconds (prevents tracking users who just skip through quickly)
    const initialTimer = setTimeout(() => {
      api.post(`/courses/${courseId}/progress`, payload).catch(e => console.log(e));
    }, 10000); 

    // Periodic ping every 60 seconds to accurately log total study time
    const interval = setInterval(() => {
      api.post(`/courses/${courseId}/progress`, payload).catch(e => console.log(e));
    }, 60000);

    // Cleanup timers when the lesson changes or component unmounts
    return () => { clearTimeout(initialTimer); clearInterval(interval); };
  }, [activeSec, activeLesson, courseId, isLoggedIn, currentLesson]);

  // ==== Event Handlers ====

  /**
   * Handles user typing in the Notes area and auto-saves to LocalStorage.
   */
  const handleNoteChange = (e) => {
    const val = e.target.value;
    setLessonNote(val);
    localStorage.setItem(`note_${courseId}_${activeSec}_${activeLesson}`, val);
  };

  /**
   * Extracts or prepares text from the original document for TTS playback.
   */
  const loadLessonText = async () => {
    if (!currentLesson || !currentLesson.contentUrl) { alert("No document to read."); return ""; }
    if (!lessonUseOriginal) { alert("The teacher has disabled the original document for this lesson."); return ""; }
    if (ttsStatus === "speaking" || ttsStatus === "paused") return ttsText;

    setTtsStatus("loading");

    try {
      const { full, forExt } = getUrlParts(currentLesson.contentUrl);
      if (!full) throw new Error("Lesson has no document URL.");

      const lower = forExt.toLowerCase();

      // Read raw text files directly
      if (lower.endsWith(".txt")) {
        const res = await fetch(full);
        if (!res.ok) throw new Error(`Cannot load text file (HTTP ${res.status}).`);
        const text = await res.text();
        if (!text.trim()) throw new Error("Text file is empty.");
        setTtsText(text); setTtsStatus("ready"); return text;
      }

      // Request backend to extract text from PDFs or Office documents
      const res = await api.get(`/tts/extract?url=${encodeURIComponent(full)}`);
      const text = res.data.text || "";
      if (!text.trim()) throw new Error("No readable text returned from server.");

      setTtsText(text); setTtsStatus("ready"); return text;
    } catch (err) {
      setTtsStatus("idle");
      alert(err.message || "Cannot read text from this document for TTS yet.");
      return "";
    }
  };

  /**
   * Toggles the playback state (Play/Pause/Resume) of the Text-to-Speech engine.
   */
  const handlePlayPause = async () => {
    if (!currentLesson) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Your browser does not support text-to-speech."); return;
    }

    if (ttsStatus === "speaking") { window.speechSynthesis.pause(); setTtsStatus("paused"); return; }
    if (ttsStatus === "paused") { window.speechSynthesis.resume(); setTtsStatus("speaking"); return; }

    let text = ttsText;

    // Build or fetch text if not already loaded
    if (!text) {
      if (viewMode === "ai" && lessonUseAiSlides) {
        const slides = Array.isArray(currentLesson.aiSlides) ? currentLesson.aiSlides : [];
        if (!slides.length) { alert("No AI slides available for this lesson."); return; }
        const built = buildSlidesTts(slides);
        if (!built) { alert("Cannot build readable text from AI slides."); return; }
        text = built; setTtsText(built);
      }
      else if (lessonUseOriginal && lessonHasFile) {
        text = await loadLessonText();
        if (!text) return;
      } else {
        alert("This view has no content that can be read aloud."); return;
      }
    }

    // Configure and start speech
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; 
    u.rate = 1.0;
    u.onend = () => setTtsStatus("ready");
    u.onerror = () => setTtsStatus("ready");

    utteranceRef.current = u;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setTtsStatus("speaking");
  };

  // ==== View Renderers ====

  /**
   * Renders the iframe viewer for original documents (PDF, DOCX, PPTX).
   */
  const renderDocViewer = () => {
    if (!currentLesson || !currentLesson.contentUrl || !lessonUseOriginal) {
      return (
        <div className="doc-empty">
          <p>This lesson does not provide the original document to students. If you are the teacher, enable “Show original document” in the editor.</p>
        </div>
      );
    }
    const { full, forExt } = getUrlParts(currentLesson.contentUrl);
    if (!full) return (<div className="doc-empty"><p>No document uploaded for this lesson yet.</p></div>);

    const lower = forExt.toLowerCase();

    // Render PDFs using Google Docs Viewer
    if (lower.endsWith(".pdf")) {
      const pdfViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(full)}&embedded=true`;
      return <iframe src={pdfViewerUrl} title={currentLesson.title || "Lesson document"} className="doc-frame" />;
    }
    // Render Office formats using Microsoft Office Viewer
    if (lower.endsWith(".ppt") || lower.endsWith(".pptx") || lower.endsWith(".doc") || lower.endsWith(".docx")) {
      const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(full)}`;
      return <iframe src={officeUrl} title={currentLesson.title || "Lesson document"} className="doc-frame" />;
    }
    // Fallback renderer
    const viewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(full)}&embedded=true`;

    return <iframe src={viewerUrl} title={currentLesson.title || "Lesson document"} className="doc-frame" />;
  };

  /**
   * Renders the interactive UI for AI-generated slides.
   */
  const renderAiSlides = () => {
    const slides = currentLesson && Array.isArray(currentLesson.aiSlides) ? currentLesson.aiSlides : [];
    if (!lessonUseAiSlides) return (<div className="doc-empty"><p>AI slides are not enabled for this lesson.</p></div>);
    if (!slides.length) return (<div className="doc-empty"><p>No AI slides were saved for this lesson.</p></div>);

    const safeIndex = Math.min(Math.max(activeSlide, 0), Math.max(slides.length - 1, 0));
    const slide = slides[safeIndex] || {};
    const bullets = Array.isArray(slide.bullets) ? slide.bullets : [];

    return (
      <div className="ai-slide-container">
        <div className="ai-slide">
          <div className="ai-slide-header">
            <span className="ai-slide-chip">Lesson {activeLesson + 1} • Slide {safeIndex + 1}</span>
            <h2 className="ai-slide-title">{slide.title || "Slide"}</h2>
          </div>
          {bullets.length > 0 ? (
            <ul className="ai-slide-list">{bullets.map((b, idx) => (<li key={idx}>{b}</li>))}</ul>
          ) : (
            slide.ttsText && (<p className="ai-slide-body">{slide.ttsText}</p>)
          )}
        </div>
        <div className="ai-slide-footer">
          <button type="button" className="btn-outline ai-slide-nav" onClick={() => setActiveSlide((s) => Math.max(0, s - 1))} disabled={safeIndex === 0}>◀ Prev</button>
          <span className="ai-slide-index">{safeIndex + 1} / {slides.length}</span>
          <button type="button" className="btn-outline ai-slide-nav" onClick={() => setActiveSlide((s) => Math.min(slides.length - 1, s + 1))} disabled={safeIndex >= slides.length - 1}>Next ▶</button>
        </div>
      </div>
    );
  };

  /**
   * Determines which viewer to display based on the active tab/viewMode.
   */
  const renderActiveView = () => {
    if (!currentLesson) return (<div className="doc-empty"><p>Select a lesson from the left to start learning.</p></div>);
    if (!lessonHasFile && !lessonUseAiSlides) return (<div className="doc-empty"><p>No document or AI slides are available for this lesson yet.</p></div>);
    if (viewMode === "ai" && lessonUseAiSlides) return renderAiSlides();
    if (viewMode === "original" && lessonUseOriginal) return renderDocViewer();

    // Fallbacks if preferred mode is disabled
    if (lessonUseOriginal) return renderDocViewer();
    if (lessonUseAiSlides) return renderAiSlides();
    return (<div className="doc-empty"><p>This lesson does not have any enabled view.</p></div>);
  };

  // ==== Chat / AI Assistant Handlers ====

  /**
   * Submits a message to the AI agent specifically contextualized to the current lesson.
   */
  const handleSendChat = async (e) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || chatLoading || !currentLesson) return;

    if (!isLoggedIn) {
      setChatMessages((prev) => [...prev, { from: "ai", text: "You need to sign in to your BrainBoost account to chat with the AI assistant for this lesson." }]);
      return;
    }

    setChatMessages((prev) => [...prev, { from: "user", text }]);
    setChatInput("");

    try {
      setChatLoading(true);
      const lessonKey = currentLesson._id || currentLesson.id || `${activeSec}-${activeLesson}`;
      const payload = {
        courseId,
        lessonKey,
        lessonTitle: currentLesson.title || "",
        userMessage: text,
        docUrl: lessonUseOriginal && currentLesson.contentUrl ? currentLesson.contentUrl : null,
        aiSlides: lessonUseAiSlides && Array.isArray(currentLesson.aiSlides) ? currentLesson.aiSlides : [],
      };

      const res = await api.post("/lesson-chat", payload);
      const answer = res.data.answer || "(No answer returned from AI.)";
      setChatMessages((prev) => [...prev, { from: "ai", text: answer }]);
      
    } catch (err) {
      console.error("[LessonChat] failed:", err);
      const msg = err.response?.data?.message || "The AI assistant is not available right now.";
      setChatMessages((prev) => [...prev, { from: "ai", text: "Sorry, I could not answer this question at the moment. " + msg }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Derive dynamic label for the audio controls
  const audioStatusText =
    ttsStatus === "loading" ? "Preparing audio for this lesson…"
      : ttsStatus === "speaking" ? "Reading aloud – press Pause to stop."
      : ttsStatus === "paused" ? "Audio paused – press Resume."
      : ttsStatus === "ready" && ttsText ? "Audio ready – press Play to listen again."
      : viewMode === "ai" && lessonUseAiSlides ? "Press Play to listen to the AI slides."
      : lessonUseOriginal && lessonHasFile ? "Press Play to listen to the original document."
      : "Audio is not available for this lesson yet.";

  const chatDisabled = !currentLesson || !authChecked || !isLoggedIn;

  // ==== Loading & Error Rendering ====

  if (loading) {
    return (
      <div className="learning-page">
        <SiteHeader />
        <main className="learning-container"><p>Loading course content…</p></main>
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
          <button className="btn-secondary" onClick={() => navigate("/courses")}>← Back to Courses</button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  // ==== Main Layout Rendering ====

  return (
    <div className="learning-page">
      <SiteHeader />

      <main className="learning-container">
        <nav className="breadcrumb">
          <Link to="/courses">Courses</Link>
          <span>›</span>
          <Link to={`/courses/${courseId}`}>{course.title}</Link>
          <span>›</span>
          <span>Learn</span>
        </nav>

        {/* 3-Column Layout: Sidebar (Syllabus) | Main (Content) | Tools (AI & Notes) */}
        <div className="learning-layout">
            
          {/* Column 1: Syllabus Sidebar */}
          <aside className="learning-sidebar">
            <h2 className="course-title">{course.title}</h2>
            <p className="course-sub">Choose a lesson. The content will appear on the right.</p>

            <div className="section-list">
              {syllabus.map((sec, si) => (
                <div key={si} className="section-block">
                  <button
                    className={`section-header ${si === activeSec ? "active" : ""}`}
                    onClick={() => { setActiveSec(si); setActiveLesson(0); }}
                  >
                    <span className="section-index">{si + 1}.</span>
                    <span>{sec.title}</span>
                  </button>

                  {si === activeSec && (
                    <ul className="lesson-list">
                      {sec.lessons.map((l, li) => (
                        <li
                          key={li}
                          className={`lesson-item ${li === activeLesson ? "lesson-active" : ""}`}
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

          {/* Column 2: Main Lesson Content */}
          <section className="learning-main">
            {/* View Mode Toggle */}
            <div className="viewer-mode-tabs">
              <button
                type="button"
                className={`viewer-mode-tab ${viewMode === "original" ? "active" : ""}`}
                onClick={() => { stopTts(); setTtsText(""); setTtsStatus("idle"); setViewMode("original"); }}
                disabled={!lessonUseOriginal}
              >
                Original document
              </button>
              <button
                type="button"
                className={`viewer-mode-tab ${viewMode === "ai" ? "active" : ""}`}
                onClick={() => { stopTts(); setTtsText(""); setTtsStatus("idle"); setViewMode("ai"); }}
                disabled={!lessonUseAiSlides}
              >
                AI slides
              </button>
            </div>

            {/* Document/Slide Renderer */}
            <div className="doc-container">{renderActiveView()}</div>

            <div className="audio-bar"><span className="audio-label">{audioStatusText}</span></div>

            {/* Content Actions (Audio & Notes Toggle) */}
            <div className="controls-row">
              <button type="button" className="btn-primary" onClick={handlePlayPause} disabled={ttsStatus === "loading" || !canPlayAudio}>
                <i className={`bi ${ttsStatus === "speaking" ? "bi-pause-circle-fill" : "bi-play-circle-fill"}`}></i> {ttsStatus === "loading" ? "Loading text…" : ttsStatus === "speaking" ? "Pause" : ttsStatus === "paused" ? "Resume" : "Play Audio"}
              </button>
              <button type="button" className="btn-outline" onClick={() => setShowNotes(!showNotes)}>
                <i className="bi bi-pencil-square"></i> {showNotes ? "Hide Notes" : "Take Notes"}
              </button>
            </div>
          </section>

          {/* Column 3: Learning Tools (Notes & AI Chat) */}
          <aside className="learning-tools-panel">
              {/* Personal Notes Box (Toggled visibility) */}
              {showNotes && (
                  <div className="notes-container">
                      <div className="notes-header">
                          <h3><i className="bi bi-journal-text text-primary"></i> Personal Notes</h3>
                          <span className="notes-hint">Auto-saved locally</span>
                      </div>
                      <textarea 
                          className="notes-textarea" 
                          placeholder="Type your notes for this lesson here..."
                          value={lessonNote}
                          onChange={handleNoteChange}
                      ></textarea>
                  </div>
              )}

              {/* AI Chat Box (Always visible layout) */}
              <div className="ai-chat-panel">
                  <header className="ai-modal-header">
                      <h3><i className="bi bi-robot text-primary"></i> BrainBoost AI</h3>
                  </header>

                  <div className="ai-modal-body">
                      {chatMessages.map((m, idx) => (
                          <div key={idx} className={`ai-msg ai-msg-${m.from === "user" ? "user" : "ai"}`}>
                              <div className="ai-msg-bubble">{m.text}</div>
                          </div>
                      ))}
                      {authChecked && !isLoggedIn && (
                          <div className="ai-login-hint">Sign in to your account to chat.</div>
                      )}
                  </div>

                  {/* Chat Input Form */}
                  <form className="ai-input-row" onSubmit={handleSendChat}>
                      <input 
                          type="text" 
                          placeholder="Ask about this lesson..." 
                          value={chatInput} 
                          onChange={(e) => setChatInput(e.target.value)} 
                          disabled={chatLoading || chatDisabled} 
                      />
                      <button type="submit" className="btn-primary" disabled={chatLoading || chatDisabled}>
                          {chatLoading ? "..." : <i className="bi bi-send-fill"></i>}
                      </button>
                  </form>
              </div>
          </aside>

        </div>
      </main>

      <SiteFooter />
    </div>
  );
}