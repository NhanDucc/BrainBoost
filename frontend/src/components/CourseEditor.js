import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { toAbsolute } from "../utils/url";
import { useUser } from "../context/UserContext";
import "../css/CourseEditor.css";

/** Gợi ý subject/grade – có thể chỉnh theo hệ thống của bạn */
const SUBJECTS = [
  { key: "math", name: "Mathematics" },
  { key: "english", name: "English" },
  { key: "physics", name: "Physics" },
  { key: "chemistry", name: "Chemistry" },
];

// CHỈ còn 2 loại: Lesson & Quiz
const LESSON_TYPES = [
  { key: "lesson", name: "Lesson" },
  { key: "quiz", name: "Quiz" },
];

// Các đuôi file được phép upload cho lesson (document + slide)
const LESSON_FILE_EXTS = [".pdf", ".doc", ".docx", ".txt", ".ppt", ".pptx"];

// lesson “rỗng” cho builder
const emptyLesson = () => ({
  title: "",
  type: "lesson",
  // dùng cho QUIZ: thời gian làm (phút). Với lesson sẽ để rỗng.
  durationMin: "",
  // URL tài nguyên chính (document / slide / v.v.)
  contentUrl: "",
  originalDocUrl: "",
  originalDocType: "",
  useAiSlides: false,
  showOriginalToStudents: true,
});

const emptySection = (i) => ({
  title: `Section ${i + 1}`,
  lessons: [emptyLesson()],
});

export default function CourseEditor() {
  const { user } = useUser();
  const { id } = useParams(); // undefined => new
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  // Chỉ admin/instructor được vào
  const canEdit =
    user && (user.role === "admin" || user.role === "instructor");

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Meta
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0].key);
  const [grade, setGrade] = useState("");
  const [tags, setTags] = useState([]);
  const [price, setPrice] = useState("");

  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  // Builder
  const [sections, setSections] = useState([emptySection(0)]);
  const [uploadingLesson, setUploadingLesson] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Load khi edit
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(toAbsolute(`/api/courses/${id}`), {
          credentials: "include",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.message || `HTTP ${res.status}`);
        }
        const c = await res.json();

        setTitle(c.title || "");
        setSlug(c.slug || "");
        setSubject(c.subject || SUBJECTS[0].key);
        setGrade(c.grade || "");
        setTags(Array.isArray(c.tags) ? c.tags : []);
        setPrice(c.price ?? "");
        setDescription(c.description || "");
        setCoverUrl(c.coverUrl || "");

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

  // ====== Builder ops ====== //
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
      if (list.length === 1) return prev; // giữ tối thiểu 1
      list.splice(li, 1);
      n[si] = { ...n[si], lessons: list };
      return n;
    });

  const setLesson = (si, li, patch) =>
    setSections((prev) => {
      const n = [...prev];
      const list = [...n[si].lessons];
      list[li] = { ...list[li], ...patch };
      n[si] = { ...n[si], lessons: list };
      return n;
    });

  // ====== Upload lesson document/slide ====== //
  const handleLessonFileChange = async (si, li, file) => {
    if (!file) return;

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

      let docType = "";
      if (mime.includes("pdf")) docType = "pdf";
      else if (
        mime.includes("word") ||
        mime.includes("officedocument.wordprocessingml.document")
      )
        docType = "docx";
      else if (
        mime.includes("presentation") ||
        mime.includes("powerpoint")
      )
        docType = "pptx";

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

  // ====== Validation ====== //
  const validate = () => {
    if (!canEdit) return "Forbidden";
    if (!title.trim()) return "Please enter course title.";
    if (!grade.toString().trim()) return "Please enter a grade/level.";
    if (!subject) return "Please select a subject.";
    if (!description.trim()) return "Please enter course description.";
    if (!sections.length) return "Please add at least 1 section.";
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

  // ====== Submit ====== //
  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setToast({ type: "error", msg: err });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim(),
        subject,
        grade: grade.toString().trim(),
        description,
        tags,
        price: price === "" ? null : Number(price),
        coverUrl,
        sections: sections.map((s) => ({
          title: s.title.trim(),
          lessons: s.lessons.map((L) => ({
            title: L.title.trim(),
            type: L.type,
            // durationMin bây giờ dùng cho QUIZ time
            durationMin:
              L.type === "quiz" && L.durationMin !== ""
                ? Number(L.durationMin)
                : null,
            contentUrl: (L.contentUrl || "").trim(),
            originalDocUrl: (L.originalDocUrl || "").trim(),
            originalDocType: L.originalDocType || "",
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
      setTimeout(() => navigate("/instructor"), 700);
    } catch (e) {
      setToast({ type: "error", msg: `Save failed: ${e.message}` });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSaving(false);
    }
  };

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
            {/* ===== Meta ===== */}
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

                <label className="form-row">
                  <span>Slug (optional)</span>
                  <input
                    placeholder="my-awesome-course"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                  />
                </label>

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

                <label className="form-row">
                  <span>Grade/Level</span>
                  <input
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                  />
                </label>

                <label className="form-row full">
                  <span>Description</span>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>

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

                <div className="form-row full">
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
                    />
                  )}
                </div>
              </div>
            </section>

            {/* ===== Builder ===== */}
            <section className="card">
              <h3>Curriculum</h3>

              {/* Hộp chú ý cho giáo viên – hiển thị 1 lần ở đầu card */}
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

                          {/* Lesson / Quiz */}
                          <select
                            className="ls-type"
                            value={ls.type}
                            onChange={(e) => {
                              const newType = e.target.value;
                              const patch = { type: newType };
                              // nếu chuyển từ quiz → lesson thì xoá thời gian
                              if (newType !== "quiz") {
                                patch.durationMin = "";
                              }
                              setLesson(si, li, patch);
                            }}
                          >
                            {LESSON_TYPES.map((t) => (
                              <option key={t.key} value={t.key}>
                                {t.name}
                              </option>
                            ))}
                          </select>

                          {/* Chỉ hiện ô thời gian khi là Quiz */}
                          {ls.type === "quiz" ? (
                            <input
                              className="ls-dur"
                              type="number"
                              min="0"
                              placeholder="Quiz min"
                              value={ls.durationMin ?? ""}
                              onChange={(e) =>
                                setLesson(si, li, {
                                  durationMin: e.target.value,
                                })
                              }
                            />
                          ) : (
                            <div /> /* giữ layout */
                          )}

                          {/* Khối resource: checkbox + upload */}
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
                                <span>Let students open the original document</span>
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
                                  Allow BrainBoost to generate AI slides (beta)
                                </span>
                              </label>
                            </div>

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
                                <span className="ls-uploading">
                                  Uploading…
                                </span>
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
                                    })
                                  }
                                >
                                  Remove file
                                </button>
                              )}
                            </div>

                            {(ls.originalDocUrl || ls.useAiSlides) && (
                              <div className="lesson-ai-preview">
                                <div className="lesson-ai-preview-title">
                                  This lesson will use:
                                </div>
                                <p>
                                  {ls.originalDocUrl
                                    ? "• Original document is available in the player."
                                    : "• No original file uploaded yet."}
                                  <br />
                                  {ls.useAiSlides
                                    ? "• AI slides will be generated from this file."
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

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      <SiteFooter />
    </div>
  );
}
