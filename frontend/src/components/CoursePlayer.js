import { useEffect, useRef, useState } from "react";
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
 * Builds an audio reading queue where each text chunk is tagged with its source Slide Index.
 * This is crucial because it allows the UI to know exactly which slide's text is currently being read, 
 * enabling the system to automatically flip to the correct slide during playback.
 * @param {Array} slides - Array of AI slide objects.
 * @returns {Array} Array of objects: { text: string, slideIndex: number }
 */
const buildSlideAwareQueue = (slides) => {
  if (!Array.isArray(slides) || !slides.length) return [];
  const queue = [];

  slides.forEach((s, index) => {
    const title = (s.title || "").toString().trim();
    const bullets = Array.isArray(s.bullets)
      ? s.bullets.map((b) => String(b || "").trim()).filter(Boolean)
      : [];

    // Prioritize explicit TTS text if provided by the instructor/AI
    const explicit = (s.ttsText || "").toString().trim();

    let slideText = explicit;
    if (!slideText) {
      // Fallback: Construct readable text from slide title and bullets
      const parts = [];
      if (title) parts.push(`Slide ${index + 1}: ${title}`);
      if (bullets.length) parts.push(bullets.join(". "));
      slideText = parts.join(". ");
    }

    // Split the slide's text into smaller chunks for fast streaming,
    // and attach the current slide index to every chunk.
    if (slideText) {
      const chunks = chunkTextForInstantPlay(slideText, 600);
      chunks.forEach((chunk) => {
        queue.push({ text: chunk, slideIndex: index });
      });
    }
  });

  return queue;
};

/**
 * Splits long text into smaller chunks (~600 characters max) by sentence endings.
 * This is crucial for the "Instant Play" AI Audio Streaming feature, allowing 
 * the frontend to fetch and play short audio clips immediately while preloading the rest.
 * @param {String} text - Full text to split.
 * @param {Number} maxLength - Max length per chunk.
 * @returns {Array<String>} Array of smaller text chunks.
 */
const chunkTextForInstantPlay = (text, maxLength = 600) => {
  if (!text) return [];
  // Match sentences ending with ., !, ?, or newlines
  const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
  const chunks = [];
  let currentChunk = "";

  for (let s of sentences) {
    if (currentChunk.length + s.length > maxLength) {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      currentChunk = s;
    } else {
      currentChunk += s;
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks;
};

// ==== Main Component ====

/**
 * CoursePlayer Component
 * The main learning interface where students can view documents, interact with AI slides,
 * take personal notes, listen to text-to-speech, and chat with an AI assistant.
 */
export default function CoursePlayer() {
  // ---- Routing ----
  const { courseId } = useParams();
  const navigate = useNavigate();

  // ---- Course Data & Navigation States ----
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSec, setActiveSec] = useState(0);    // Tracks currently selected section
  const [activeLesson, setActiveLesson] = useState(0); // Tracks currently selected lesson

  // ---- Authentication States ----
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  // ---- Personal Notes States ----
  const [showNotes, setShowNotes] = useState(false); // Toggles the note panel visibility
  const [lessonNote, setLessonNote] = useState("");

  // ---- AI Assistant Chat States ----
  const [chatMessages, setChatMessages] = useState([
    {
      from: "ai",
      text: "Hi, I'm BrainBoost Assistant. Ask me about this lesson and I will answer based on the uploaded content.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // ---- Text-to-Speech (TTS) Core States ----
  const [ttsStatus, setTtsStatus] = useState("idle"); // 'idle' | 'loading' | 'ready' | 'speaking' | 'paused'
  const [ttsText, setTtsText] = useState("");
  const utteranceRef = useRef(null); // Holds the native browser SpeechSynthesisUtterance object

  // ---- Advanced AI TTS Streaming States ----
  const [ttsMode, setTtsMode] = useState("browser"); // Defaults to 'browser' for guests

  // Ref managing the sequential audio queue for BOTH Browser and AI Voice modes
  const ttsQueueRef = useRef({
    chunks: [],          // Stores array of objects: [{ text, slideIndex }]
    currentIndex: 0,     // Which chunk is currently playing
    currentAudio: null,  // The HTMLAudioElement currently playing (AI Mode)
    nextAudio: null,     // The HTMLAudioElement preloaded in the background (AI Mode)
    preloadedIndex: -1,  // Tracks which index has already been preloaded
  });

  // ---- UI View Modes ----
  const [viewMode, setViewMode] = useState("original"); // 'original' (Document) or 'ai' (Slides)
  const [activeSlide, setActiveSlide] = useState(0);

  // ---- Global UI Toast Notification ----
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  /**
   * Displays a self-dismissing toast notification.
   */
  const showToast = (msg, type = "error") => {
    setToast({ msg, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  };

  /**
   * Hard resets both Browser and AI TTS engines.
   * Cancels current playback, clears preloaded queues, and resets status.
   */
  const stopTts = () => {
    // Cancel Native Browser TTS
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // Pause and reset active AI audio
    if (ttsQueueRef.current.currentAudio) {
      ttsQueueRef.current.currentAudio.pause();
      ttsQueueRef.current.currentAudio.currentTime = 0;
    }

    // Prevent preloaded audio from playing accidentally
    if (ttsQueueRef.current.nextAudio) {
      ttsQueueRef.current.nextAudio.pause();
    }
    
    // Wipe the queue memory
    ttsQueueRef.current = {
      chunks: [],
      currentIndex: 0,
      currentAudio: null,
      nextAudio: null,
      preloadedIndex: -1,
    };
    
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
  useEffect(() => { return () => stopTts(); }, []);

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
   * Fetches the raw text of the document for TTS to read aloud.
   * Leverages the backend extraction service for PDFs and Office docs.
   */
  const loadOriginalDocText = async () => {
    try {
      const { full, forExt } = getUrlParts(currentLesson.contentUrl);
      if (!full) throw new Error("Lesson has no document URL.");

      const lower = forExt.toLowerCase();

      // Read simple .txt files directly without pinging the extraction API
      if (lower.endsWith(".txt")) {
        const res = await fetch(full);
        if (!res.ok) throw new Error(`Cannot load text file (HTTP ${res.status}).`);
        const text = await res.text();
        if (!text.trim()) throw new Error("Text file is empty.");
        setTtsText(text); setTtsStatus("ready");
        return text;
      }

      // Proxy complex files through backend extraction logic
      const res = await api.get(`/tts/extract?url=${encodeURIComponent(full)}`);
      const text = res.data.text || "";
      if (!text.trim()) throw new Error("No readable text returned from server.");

      setTtsText(text); setTtsStatus("ready"); return text;
    } catch (err) {
      setTtsStatus("idle");
      showToast(err.message || "Cannot read text from this document for TTS yet.");
      return "";
    }
  };

  /**
   * Browser Voice: Queue-based playback synchronized with UI Slides.
   * Recursive function that plays the next chunk and flips the slide automatically.
   */
  const playBrowserSequence = (index) => {
    if (index >= ttsQueueRef.current.chunks.length) {
      setTtsStatus("ready");
      return;
    }

    const currentChunkObj = ttsQueueRef.current.chunks[index];
    
    // Automatic Slide Sync: Update the UI activeSlide to match the text currently being read
    if (viewMode === "ai") setActiveSlide(currentChunkObj.slideIndex);

    const u = new SpeechSynthesisUtterance(currentChunkObj.text);
    u.lang = "en-US"; 
    u.rate = 1.0;
    
    // Trigger recursion: When this chunk ends, proceed to the next one
    u.onend = () => playBrowserSequence(index + 1);
    u.onerror = () => setTtsStatus("ready");
    
    utteranceRef.current = u;
    ttsQueueRef.current.currentIndex = index;

    window.speechSynthesis.cancel(); // Clear any hung processes
    window.speechSynthesis.speak(u);
    setTtsStatus("speaking");
  };

  /**
   * AI Voice: Advanced Streaming Engine.
   * Implements a Preloader logic to ensure zero-latency playback, synced with slides.
   */
  const playAiSequence = async (index) => {
    // Stop condition: End of chunks array
    if (index >= ttsQueueRef.current.chunks.length) {
      setTtsStatus("ready");
      return;
    }

    const currentChunkObj = ttsQueueRef.current.chunks[index];
    
    // Automatic Slide Sync: Update the UI activeSlide to match the text currently being read
    if (viewMode === "ai") setActiveSlide(currentChunkObj.slideIndex);

    let audioToPlay = null;

    // If the audio was already preloaded in the background, use it immediately!
    if (ttsQueueRef.current.preloadedIndex === index && ttsQueueRef.current.nextAudio) {
      audioToPlay = ttsQueueRef.current.nextAudio;
    } else {
      // Fallback: Fetch directly if not preloaded (e.g., the very first chunk)
      setTtsStatus("loading");
      try {
        const res = await api.post("/tts/synthesize", { text: currentChunkObj.text });
        audioToPlay = new Audio(`data:audio/mp3;base64,${res.data.audioContent}`);
      } catch (err) {
        console.error("AI TTS Error:", err);
        showToast("Failed to play audio chunk. Check your internet connection.", "error");
        setTtsStatus("ready");
        return;
      }
    }

    ttsQueueRef.current.currentAudio = audioToPlay;
    ttsQueueRef.current.currentIndex = index;
    
    // Trigger recursion: As soon as the current audio ends, instantly play the next one
    audioToPlay.onended = () => playAiSequence(index + 1);
    audioToPlay.onerror = () => setTtsStatus("ready");

    audioToPlay.play();
    setTtsStatus("speaking");

    // Background Preloader: While the user is listening to `index`, quietly fetch `index + 1`
    const nextIndex = index + 1;
    if (nextIndex < ttsQueueRef.current.chunks.length) {
      const nextText = ttsQueueRef.current.chunks[nextIndex].text;
      api.post("/tts/synthesize", { text: nextText })
        .then(res => {
          ttsQueueRef.current.nextAudio = new Audio(`data:audio/mp3;base64,${res.data.audioContent}`);
          ttsQueueRef.current.preloadedIndex = nextIndex;
        })
        .catch(e => console.error("Preload error", e));
    }
  };

  /**
   * Main Router for the Play/Pause button. 
   * Determines which TTS engine to control and prepares the queue based on viewMode.
   */
  const handlePlayPause = async () => {
    if (!currentLesson) return;

    // Pause / Resume Logic (If a queue is already active)
    if (ttsStatus === "speaking" || ttsStatus === "paused") {
      if (ttsMode === "browser") {
        if (ttsStatus === "speaking") { 
          window.speechSynthesis.pause(); 
          setTtsStatus("paused"); 
        }
        else { 
          window.speechSynthesis.resume(); 
          setTtsStatus("speaking"); 
        }
      } else {
        // Security Check
        if (!isLoggedIn) {
          showToast("Please sign in to use AI Voice feature.", "info");
          setTtsMode("browser");
          return;
        }
        if (ttsStatus === "speaking" && ttsQueueRef.current.currentAudio) { 
          ttsQueueRef.current.currentAudio.pause(); 
          setTtsStatus("paused"); 
        }
        else if (ttsStatus === "paused" && ttsQueueRef.current.currentAudio) { 
          ttsQueueRef.current.currentAudio.play(); 
          setTtsStatus("speaking"); 
        }
      }
      return; 
    }

    // Initial Play Logic (Generating the Queue from scratch)
    setTtsStatus("loading");

    let queue = [];

    // Construct Queue based on whether the user is viewing Slides or Document
    if (viewMode === "ai" && lessonUseAiSlides) {
      const slides = Array.isArray(currentLesson.aiSlides) ? currentLesson.aiSlides : [];
      if (!slides.length) { showToast("No AI slides available.", "error"); setTtsStatus("idle"); return; }
      
      // Use the slide-aware function to track indices for automatic syncing
      queue = buildSlideAwareQueue(slides); 
    } 
    else if (lessonUseOriginal && lessonHasFile) {
      const rawText = await loadOriginalDocText();
      if (!rawText) { 
        setTtsStatus("idle"); 
        return; 
      }
      
      // Documents don't have slide indices, so default slideIndex to 0 for all chunks
      const chunks = chunkTextForInstantPlay(rawText, 600);
      queue = chunks.map(chunk => ({ text: chunk, slideIndex: 0 }));
    } 
    else {
      showToast("This view has no content to read.", "error");
      setTtsStatus("idle");
      return;
    }

    // Abort if extraction yielded nothing
    if (!queue.length) {
      showToast("Cannot extract text.", "error");
      setTtsStatus("idle");
      return;
    }

    // Save the newly generated queue to the Ref
    ttsQueueRef.current.chunks = queue;
    ttsQueueRef.current.currentIndex = 0;

    // Start the corresponding Engine
    if (ttsMode === "browser") {
      playBrowserSequence(0);
    } else {
      if (!isLoggedIn) {
        showToast("Please sign in or create an account to unlock Premium AI Voice.", "info");
        setTtsMode("browser");
        setTtsStatus("idle");
        return;
      }
      playAiSequence(0); 
    }
  };

  /** * Switch TTS engines. Restricts "ai" mode to authenticated users only.
   */
  const handleModeChange = (mode) => {
    if (mode === "ai" && !isLoggedIn) {
      showToast("Please sign in or create a BrainBoost account to unlock the premium AI Voice feature.", "info");
      return;
    }
    stopTts();
    setTtsMode(mode);
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
        
        {/* ---- Breadcrumb Navigation ---- */}
        <nav className="breadcrumb">
          <Link to="/courses">Courses</Link><span>›</span>
          <Link to={`/courses/${courseId}`}>{course.title}</Link><span>›</span>
          <span>Learn</span>
        </nav>

        {/* ---- Core 3-Column Layout ---- */}
        <div className="learning-layout">
          
          {/* Column 1: Interactive Syllabus Sidebar */}
          <aside className="learning-sidebar">
            <h2 className="course-title">{course.title}</h2>
            <p className="course-sub">Choose a lesson. The content will appear on the right.</p>
            <div className="section-list">
              {syllabus.map((sec, si) => (
                <div key={si} className="section-block">
                  {/* Section Headers act as accordions */}
                  <button
                    className={`section-header ${si === activeSec ? "active" : ""}`}
                    onClick={() => { setActiveSec(si); setActiveLesson(0); }}
                  >
                    <span className="section-index">{si + 1}.</span>
                    <span>{sec.title}</span>
                  </button>

                  {/* Render child lessons if the parent section is active */}
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

          {/* Column 2: Main Educational Content Display */}
          <section className="learning-main">
            {/* View Mode Switches */}
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

            <div className="doc-container">{renderActiveView()}</div>
            <div className="audio-bar"><span className="audio-label">{audioStatusText}</span></div>

            {/* Media Controls & Feature Toggles */}
            <div className="controls-row">
              <div className="tts-toggle-wrapper">
                  <button 
                      type="button" 
                      className={`tts-mode-btn ${ttsMode === 'browser' ? 'active' : ''}`}
                      onClick={() => handleModeChange('browser')}
                      title="Standard robotic voice (Offline)"
                  >
                      <i className="bi bi-laptop"></i> Standard Voice
                  </button>
                  <button 
                      type="button" 
                      className={`tts-mode-btn ${ttsMode === 'ai' ? 'active' : ''}`}
                      onClick={() => handleModeChange('ai')}
                      title={isLoggedIn ? "Expressive AI voice (Requires Internet)" : "Sign in to unlock Premium AI Voice"}
                  >
                      <i className="bi bi-stars"></i> AI Voice 
                      {!isLoggedIn && <i className="bi bi-lock-fill" style={{ marginLeft: '4px', fontSize: '0.8rem', opacity: 0.7 }}></i>}
                  </button>
              </div>

              <button type="button" className="btn-primary" onClick={handlePlayPause} disabled={ttsStatus === "loading" || !canPlayAudio}>
                <i className={`bi ${ttsStatus === "speaking" ? "bi-pause-circle-fill" : "bi-play-circle-fill"}`}></i> {ttsStatus === "loading" ? "Loading text…" : ttsStatus === "speaking" ? "Pause" : ttsStatus === "paused" ? "Resume" : "Play Audio"}
              </button>
              <button type="button" className="btn-outline" onClick={() => setShowNotes(!showNotes)}>
                <i className="bi bi-pencil-square"></i> {showNotes ? "Hide Notes" : "Take Notes"}
              </button>
            </div>
          </section>

          {/* Column 3: Utility Tools (Notes & Chat) */}
          <aside className="learning-tools-panel">
              
              {/* Local Storage Notes Box */}
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

              {/* Static AI Assistant Panel */}
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

      {/* ===== GLOBAL TOAST UI ===== */}
      {toast && (
          <div className={`toast ${toast.type}`}>
              {toast.type === 'error' ? <i className="bi bi-exclamation-octagon-fill"></i> : <i className="bi bi-info-circle-fill"></i>}
              <span>{toast.msg}</span>
          </div>
      )}

      <SiteFooter />
    </div>
  );
}