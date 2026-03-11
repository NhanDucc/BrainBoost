import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { toAbsolute } from "../utils/url";
import { useUser } from "../context/UserContext";
import "../css/CourseEditor.css";

// ==== Constants & Helper Functions ====

/** * Predefined list of subjects. 
 * Can be expanded or fetched from a database in the future. 
 */
const SUBJECTS = [
  { key: "math", name: "Mathematics" },
  { key: "english", name: "English" },
  { key: "physics", name: "Physics" },
  { key: "chemistry", name: "Chemistry" },
];

/** Supported lesson types in the curriculum builder */
const LESSON_TYPES = [
  { key: "lesson", name: "Lesson" },
  { key: "quiz", name: "Quiz" },
];

/** Allowed file extensions for document and presentation uploads */
const LESSON_FILE_EXTS = [".pdf", ".doc", ".docx", ".txt", ".ppt", ".pptx"];

/** Validates if a string is a valid MongoDB ObjectId */
const isMongoId = (val) =>
  typeof val === "string" && /^[0-9a-fA-F]{24}$/.test(val);

/** * Factory function to generate an empty, default Lesson object.
 * Used when a teacher clicks "+ Lesson" in the builder.
 */
const emptyLesson = () => ({
  title: "",
  type: "lesson",
  durationMin: "",
  contentUrl: "",
  originalDocUrl: "",
  originalDocType: "",
  aiSlides: [],
  useAiSlides: false,
  showOriginalToStudents: true,
});

/** * Factory function to generate an empty Section object.
 */
const emptySection = (i) => ({
  title: `Section ${i + 1}`,
  lessons: [emptyLesson()],
});

// ==== Main Component ====

export default function CourseEditor() {
const { user } = useUser();
  const { id } = useParams(); // If ID is present, we are in Edit Mode; otherwise Create Mode
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  // Role-based Access Control: Only admins and instructors can access this editor
  const canEdit = user && (user.role === "admin" || user.role === "instructor");

  // ---- UI & Network States ----
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null); // Manages success/error popup messages

  // ---- Course Metadata States ----
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0].key);
  const [grade, setGrade] = useState("");
  const [tags, setTags] = useState([]);
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [learn, setLearn] = useState(["", "", "", ""]); // "What you'll learn" bullet points

  // ---- Curriculum Builder States ----
  const [sections, setSections] = useState([emptySection(0)]);
  const [uploadingLesson, setUploadingLesson] = useState(null); // Tracks which lesson is currently uploading a file
  const [aiGeneratingLesson, setAiGeneratingLesson] = useState(null); // Tracks which lesson is generating AI slides

  // Scroll to top on initial mount
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // ==== Data Fetching (Edit Mode) ====

  useEffect(() => {
    if (!isEdit) return;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(toAbsolute(`/api/courses/${id}`), { credentials: "include", });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.message || `HTTP ${res.status}`);
        }
        const c = await res.json();

        // Populate metadata states
        setTitle(c.title || "");
        setSlug(c.slug || "");
        setSubject(c.subject || SUBJECTS[0].key);
        setGrade(c.grade || "");
        setTags(Array.isArray(c.tags) ? c.tags : []);
        setPrice(c.price ?? "");
        setDescription(c.description || "");
        setCoverUrl(c.coverUrl || "");
        setLearn(Array.isArray(c.learn) && c.learn.length > 0 ? c.learn : ["", "", "", ""]);

        // Populate curriculum states, applying fallback defaults if data is missing
        setSections(
          Array.isArray(c.sections) && c.sections.length
            ? c.sections.map((s) => ({
                title: s.title || "",
                lessons: (s.lessons || []).map((ls) => ({
                  title: ls.title || "",
                  type: ls.type || "lesson",
                  durationMin: ls.durationMin ?? "",
                  contentUrl: ls.contentUrl || "",
                  originalDocUrl: ls.originalDocUrl || "",
                  originalDocType: ls.originalDocType || "",
                  aiSlides: Array.isArray(ls.aiSlides) ? ls.aiSlides : [],
                  useAiSlides: !!ls.useAiSlides,
                  showOriginalToStudents:
                    typeof ls.showOriginalToStudents === "boolean"
                      ? ls.showOriginalToStudents
                      : true,
                })),
              }))
            : [emptySection(0)]
        );
      } catch (e) {
        setToast({ type: "error", msg: `Load failed: ${e.message}` });
      } finally {
        setLoading(false);
        setTimeout(() => setToast(null), 3500);
      }
    })();
    // eslint-disable-next-line
  }, [isEdit, id]);

  // ====== Curriculum Builder Operations ====== //

  const addSection = () =>
    setSections((prev) => [...prev, emptySection(prev.length)]);

  const removeSection = (si) =>
    setSections((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== si)
    );

  const changeSectionTitle = (si, val) =>
    setSections((prev) => {
      const n = [...prev];
      n[si] = { ...n[si], title: val };
      return n;
    });

  const addLesson = (si) =>
    setSections((prev) => {
      const n = [...prev];
      const sec = { ...n[si], lessons: [...n[si].lessons, emptyLesson()] };
      n[si] = sec;
      return n;
    });

  const removeLesson = (si, li) =>
    setSections((prev) => {
      const n = [...prev];
      const list = [...n[si].lessons];
      if (list.length === 1) return prev; // Enforce minimum 1 lesson per section
      list.splice(li, 1);
      n[si] = { ...n[si], lessons: list };
      return n;
    });

  /** Updates specific properties of a lesson without overwriting the whole object */
  const setLesson = (si, li, patch) =>
    setSections((prev) => {
      const n = [...prev];
      const list = [...n[si].lessons];
      list[li] = { ...list[li], ...patch };
      n[si] = { ...n[si], lessons: list };
      return n;
    });

  // ==== File Upload Handler ==== //

  const handleLessonFileChange = async (si, li, file) => {
    if (!file) return;

    // Validate file extension against allowed types
    const lowerName = file.name.toLowerCase();
    const ok = LESSON_FILE_EXTS.some((ext) => lowerName.endsWith(ext));
    if (!ok) {
      setToast({
        type: "error",
        msg: "Only PDF, Word, text, or slide (PPT/PPTX) files are allowed.",
      });
      setTimeout(() => setToast(null), 3500);
      return;
    }

    try {
      setUploadingLesson(`${si}-${li}`);

      // Prepare form data for the backend Multer/Cloudinary upload endpoint
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(toAbsolute("/api/courses/upload-doc"), {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      const url = data.url || "";
      const mime = (data.mimeType || file.type || "").toLowerCase();

      // Determine document type to help the frontend select the correct viewer iframe
      let docType = "";
      if (mime.includes("pdf")) docType = "pdf";
      else if (
        mime.includes("word") ||
        mime.includes("officedocument.wordprocessingml.document")
      )
        docType = "docx";
      else if (mime.includes("presentation") || mime.includes("powerpoint"))
        docType = "pptx";

      // Update the lesson state with the returned Cloudinary URLs
      setLesson(si, li, {
        contentUrl: url,
        originalDocUrl: url,
        originalDocType: docType,
      });

      setToast({ type: "success", msg: "Document/slide uploaded." });
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      console.error("Upload-doc error:", e);
      setToast({ type: "error", msg: `Upload failed: ${e.message}` });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setUploadingLesson(null);
    }
  };

  // ==== AI Slide Generation Handler ==== //

  const handleGenerateSlides = async (si, li, lesson) => {
    // Prerequisites for AI generation
    if (!lesson.useAiSlides) {
      setToast({
        type: "error",
        msg: "Please tick 'Allow BrainBoost to generate AI slides' first.",
      });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    if (!lesson.originalDocUrl) {
      setToast({
        type: "error",
        msg: "Please upload a teaching document first.",
      });
      setTimeout(() => setToast(null), 2500);
      return;
    }

    const hasValidCourseId = isEdit && id && isMongoId(id);

    try {
      setAiGeneratingLesson(`${si}-${li}`);

      let endpoint;
      let body;

      // Determine API endpoint based on whether the course is saved or brand new
      if (hasValidCourseId) {
        endpoint = toAbsolute(
          `/api/courses/${id}/sections/${si}/lessons/${li}/gen-slides`
        );
        body = JSON.stringify({
          numSlides: 10,
        });
      } else {
        endpoint = toAbsolute("/api/ai-slides/generate");
        body = JSON.stringify({
          docUrl: lesson.originalDocUrl,
          maxSlides: 10,
        });
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      const slides = Array.isArray(data.slides) ? data.slides : [];

      // Update lesson state with the generated slides array
      setLesson(si, li, {
        aiSlides: slides,
        useAiSlides: true,
      });

      setToast({
        type: "success",
        msg: `Generated ${slides.length} AI slides for this lesson.`,
      });
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      console.error("[AI-SLIDES] Frontend error:", e);
      setToast({
        type: "error",
        msg: `Generate slides failed: ${e.message}`,
      });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setAiGeneratingLesson(null);
    }
  };

  // ==== Validation & Submission ==== //

  const validate = () => {
    if (!canEdit) return "Forbidden";
    if (!title.trim()) return "Please enter course title.";
    if (!grade.toString().trim()) return "Please enter a grade/level.";
    if (!subject) return "Please select a subject.";
    if (!description.trim()) return "Please enter course description.";
    if (!sections.length) return "Please add at least 1 section.";

    // Deep validation for curriculum structure
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      if (!s.title.trim()) return `Section ${i + 1}: title is required.`;
      if (!s.lessons.length)
        return `Section ${i + 1}: add at least 1 lesson.`;
      for (let j = 0; j < s.lessons.length; j++) {
        const L = s.lessons[j];
        if (!L.title.trim())
          return `Section ${i + 1}, Lesson ${j + 1}: title required.`;
        if (!["lesson", "quiz"].includes(L.type))
          return `Section ${i + 1}, Lesson ${j + 1}: invalid type.`;
      }
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setToast({ type: "error", msg: err });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setSaving(true);
    try {
      // Construct the payload, cleaning up empty arrays and whitespace
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        subject,
        grade: grade.toString().trim(),
        description,
        tags,
        price: price === "" ? null : Number(price),
        coverUrl,
        learn: learn.map(s => s.trim()).filter(Boolean),
        sections: sections.map((s) => ({
          title: s.title.trim(),
          lessons: s.lessons.map((L) => ({
            title: L.title.trim(),
            type: L.type,
            durationMin: L.durationMin !== "" ? Number(L.durationMin) : 0,
            contentUrl: (L.contentUrl || "").trim(),
            originalDocUrl: (L.originalDocUrl || "").trim(),
            originalDocType: L.originalDocType || "",
            aiSlides: Array.isArray(L.aiSlides) ? L.aiSlides : [],
            useAiSlides: !!L.useAiSlides,
            showOriginalToStudents:
              typeof L.showOriginalToStudents === "boolean"
                ? L.showOriginalToStudents
                : true,
          })),
        })),
      };

      const url = isEdit
        ? toAbsolute(`/api/courses/${id}`)
        : toAbsolute(`/api/courses`);
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      setToast({ type: "success", msg: isEdit ? "Updated." : "Created." });

      // Redirect back to dashboard upon successful creation/update
      setTimeout(() => navigate("/instructor"), 700);
    } catch (e) {
      setToast({ type: "error", msg: `Save failed: ${e.message}` });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  // ==== Render ====

  if (!canEdit) {
    return (
      <div className="course-page">
        <SiteHeader />
        <div className="course-container">
          <div className="empty">
            You do not have permission to access this page.
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="course-page">
      <SiteHeader />

      <main className="course-container">
        <h1 className="pg-title">
          {isEdit ? "Edit Course" : "Create Course"}
        </h1>

        {loading ? (
          <div className="empty">Loading…</div>
        ) : (
          <>
            {/* ===== Meta Information Form ===== */}
            <section className="card">
              <h3>Course information</h3>
              <div className="form-grid">
                <label className="form-row">
                  <span>Title</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>

                {/* Slug Inputs */}
                <label className="form-row">
                  <span>Slug (optional)</span>
                  <input
                    placeholder="my-awesome-course"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                  />
                </label>

                {/* Subject Inputs */}
                <label className="form-row">
                  <span>Subject</span>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  >
                    {SUBJECTS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Grade Inputs */}
                <label className="form-row">
                  <span>Grade/Level</span>
                  <input
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                  />
                </label>

                {/* Description Inputs */}
                <label className="form-row full">
                  <span>Description</span>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>

                {/* Tags Inputs */}
                <label className="form-row">
                  <span>Tags (comma separated)</span>
                  <input
                    value={tags.join(", ")}
                    onChange={(e) =>
                      setTags(
                        e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean)
                      )
                    }
                  />
                </label>

                {/* Price Inputs */}
                <label className="form-row">
                  <span>Price (optional)</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="e.g. 0 or 199"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </label>

                {/* Cover Image URL Inputs */}
                <label className="form-row full">
                  <span>Cover image URL (optional)</span>
                  <input
                    className="url-input"
                    placeholder="https://… (image URL)"
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                  />
                  {coverUrl?.trim() && (
                    <img
                      src={coverUrl}
                      alt="cover"
                      className="cover-preview"
                      style={{maxWidth: '200px'}}
                    />
                  )}
                </label>

                {/* "What you'll learn" Goals Inputs */}
                <div className="form-row full">
                  <span>What you'll learn</span>
                  <p style={{fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 8px 0'}}>
                    Add key skills students will gain. Leave input empty to ignore.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {learn.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                        <input
                          placeholder={`Goal ${idx + 1}`}
                          value={item}
                          onChange={(e) => {
                            const newLearn = [...learn];
                            newLearn[idx] = e.target.value;
                            setLearn(newLearn);
                          }}
                          style={{ flex: 1 }}
                        />
                        <button 
                          type="button" 
                          className="mini danger" 
                          onClick={() => setLearn(learn.filter((_, i) => i !== idx))}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button 
                    type="button" 
                    className="ghost-btn" 
                    style={{ width: 'fit-content', marginTop: '8px' }}
                    onClick={() => setLearn([...learn, ""])}
                  >
                    + Add more goal
                  </button>
                </div>
              </div>
            </section>

            {/* ===== Curriculum Builder ===== */}
            <section className="card">
              <h3>Curriculum</h3>

              {/* Instructor Hints & Instructions */}
              <div className="upload-hints">
                <div className="upload-hints-title">
                  Teaching files & AI slides
                </div>
                <p className="upload-hints-text">
                  For each lesson choose <strong>Lesson</strong> or{" "}
                  <strong>Quiz</strong>. You can upload a PDF/Word/Slides file.
                  Students can either view the original document or
                  AI-generated slides in the player.
                </p>
                <ul>
                  <li>
                    <strong>Lesson:</strong> upload your teaching document and
                    optionally let BrainBoost generate AI slides.
                  </li>
                  <li>
                    <strong>Quiz:</strong> set a quiz duration (in minutes) and
                    link it with your quiz content later.
                  </li>
                  <li>
                    Always review AI-generated slides and formulas before using
                    them in class.
                  </li>
                  <li>
                    Avoid uploading confidential exam papers or sensitive
                    personal data. Only extracted text is sent to the AI
                    provider.
                  </li>
                </ul>
              </div>

              <div className="sec-list">
                {sections.map((sec, si) => (
                  <div key={si} className="sec-card">
                    <div className="sec-head">
                      <input
                        className="sec-title"
                        value={sec.title}
                        onChange={(e) =>
                          changeSectionTitle(si, e.target.value)
                        }
                      />
                      <div className="sec-actions">
                        <button
                          className="mini"
                          type="button"
                          onClick={() => addLesson(si)}
                        >
                          + Lesson
                        </button>
                        <button
                          className="mini danger"
                          type="button"
                          onClick={() => removeSection(si)}
                        >
                          Delete Section
                        </button>
                      </div>
                    </div>

                    <div className="lesson-list">
                      {sec.lessons.map((ls, li) => (
                        <div key={li} className="lesson-row">
                          <span className="ls-idx">{li + 1}.</span>

                          <input
                            className="ls-title"
                            placeholder="Lesson title"
                            value={ls.title}
                            onChange={(e) =>
                              setLesson(si, li, {
                                title: e.target.value,
                              })
                            }
                          />

                          <select className="ls-type" value={ls.type} onChange={(e) => setLesson(si, li, { type: e.target.value })}>
                            {LESSON_TYPES.map((t) => (<option key={t.key} value={t.key}>{t.name}</option>))}
                          </select>

                          {/* Shared duration input for both lessons and quizzes */}
                          <input
                            className="ls-dur"
                            type="number"
                            min="0"
                            placeholder="Mins"
                            title={ls.type === 'lesson' ? 'Estimated time to learn (mins)' : 'Time limit for quiz (mins)'}
                            value={ls.durationMin ?? ""}
                            onChange={(e) =>
                              setLesson(si, li, {
                                durationMin: e.target.value,
                              })
                            }
                          />

                          {/* Resource Block: Access checkboxes and File Uploader */}
                          <div className="ls-resource">
                            <div className="lesson-switch-row">
                              <label className="lesson-switch-label">
                                <input
                                  type="checkbox"
                                  checked={!!ls.showOriginalToStudents}
                                  onChange={(e) =>
                                    setLesson(si, li, {
                                      showOriginalToStudents: e.target.checked,
                                    })
                                  }
                                />
                                <span>
                                  Let students open the original document
                                </span>
                              </label>

                              <label className="lesson-switch-label">
                                <input
                                  type="checkbox"
                                  checked={!!ls.useAiSlides}
                                  onChange={(e) =>
                                    setLesson(si, li, {
                                      useAiSlides: e.target.checked,
                                    })
                                  }
                                />
                                <span>
                                  Allow BrainBoost to generate AI slides
                                </span>
                              </label>
                            </div>

                            {/* File Upload Controls */}
                            <div className="ls-file-actions">
                              <label className="mini">
                                Upload teaching file
                                <input
                                  type="file"
                                  accept=".pdf,.doc,.docx,.txt,.ppt,.pptx"
                                  style={{ display: "none" }}
                                  onChange={(e) => {
                                    const file =
                                      e.target.files && e.target.files[0];
                                    if (file) {
                                      handleLessonFileChange(si, li, file);
                                      e.target.value = "";
                                    }
                                  }}
                                />
                              </label>

                              {uploadingLesson === `${si}-${li}` && (
                                <span className="ls-uploading">Uploading…</span>
                              )}

                              {(ls.contentUrl || ls.originalDocUrl) && (
                                <button
                                  type="button"
                                  className="mini danger"
                                  onClick={() =>
                                    setLesson(si, li, {
                                      contentUrl: "",
                                      originalDocUrl: "",
                                      originalDocType: "",
                                      aiSlides: [],
                                    })
                                  }
                                >
                                  Remove file
                                </button>
                              )}
                            </div>

                            {/* AI Slide Generation Trigger */}
                            <div className="lesson-ai-actions">
                              <button
                                type="button"
                                className="mini primary"
                                disabled={
                                  !ls.originalDocUrl ||
                                  !ls.useAiSlides ||
                                  aiGeneratingLesson === `${si}-${li}`
                                }
                                onClick={() =>
                                  handleGenerateSlides(si, li, ls)
                                }
                              >
                                {aiGeneratingLesson === `${si}-${li}`
                                  ? "Generating slides…"
                                  : "Generate AI slides"}
                              </button>

                              {!ls.originalDocUrl && (
                                <span className="lesson-hint">
                                  Upload a document first to generate slides.
                                </span>
                              )}

                              {Array.isArray(ls.aiSlides) &&
                                ls.aiSlides.length > 0 && (
                                  <span className="lesson-hint">
                                    AI slides ready: {ls.aiSlides.length} slide
                                    (s).
                                  </span>
                                )}
                            </div>

                            {/* Live status preview of the lesson modes */}
                            {(ls.originalDocUrl || ls.aiSlides?.length) && (
                              <div className="lesson-ai-preview">
                                <div className="lesson-ai-preview-title">
                                  Lesson display modes
                                </div>
                                <p>
                                  {ls.originalDocUrl
                                    ? "• Original document will be available in the player."
                                    : "• No original document uploaded yet."}
                                  <br />
                                  {ls.useAiSlides
                                    ? `• AI slides ${
                                        ls.aiSlides?.length
                                          ? `(${ls.aiSlides.length}) `
                                          : ""
                                      }will be used when students choose the AI slide mode.`
                                    : "• AI slides are currently disabled for this lesson."}
                                </p>
                              </div>
                            )}
                          </div>

                          <button
                            className="mini danger"
                            type="button"
                            onClick={() => removeLesson(si, li)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="actions">
                <button
                  className="ghost-btn"
                  type="button"
                  onClick={addSection}
                >
                  + Add Section
                </button>
                <button
                  className="primary-btn"
                  type="button"
                  disabled={saving}
                  onClick={handleSubmit}
                >
                  {saving
                    ? isEdit
                      ? "Updating…"
                      : "Publishing…"
                    : isEdit
                    ? "Update"
                    : "Publish course"}
                </button>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Global toast notification system */}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      <SiteFooter />
    </div>
  );
}