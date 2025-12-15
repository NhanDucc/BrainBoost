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

const LESSON_TYPES = [
  { key: "video", name: "Video" },
  { key: "article", name: "Article" },
  { key: "quiz", name: "Quiz" },
];

// Các đuôi file được phép upload cho lesson (document + slide)
const LESSON_FILE_EXTS = [".pdf", ".doc", ".docx", ".txt", ".ppt", ".pptx"];

const emptyLesson = () => ({
  title: "",
  type: "video",
  durationMin: "", // optional
  contentUrl: "", // link video/pdf/quiz id
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
  const canEdit = user && (user.role === "admin" || user.role === "instructor");

  // Khi tạo mới: loading = false. Khi edit: loading = true cho tới khi load xong.
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
  const [coverUrl, setCoverUrl] = useState(""); // chỉ dùng URL

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
                  type: ls.type || "video",
                  durationMin: ls.durationMin ?? "",
                  contentUrl: ls.contentUrl || "",
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

    // Check extension ở client cho rõ ràng (backend vẫn kiểm tra MIME)
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

      console.log("Upload-doc status:", res.status);

      const data = await res.json().catch(() => ({}));
      console.log("Upload-doc response:", data);

      if (!res.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      // data.url là secure_url do backend trả về
      setLesson(si, li, { contentUrl: data.url });

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
      if (!s.lessons.length) return `Section ${i + 1}: add at least 1 lesson.`;
      for (let j = 0; j < s.lessons.length; j++) {
        const L = s.lessons[j];
        if (!L.title.trim())
          return `Section ${i + 1}, Lesson ${j + 1}: title required.`;
        if (!["video", "article", "quiz"].includes(L.type))
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
        coverUrl, // chỉ là URL string
        sections: sections.map((s) => ({
          title: s.title.trim(),
          lessons: s.lessons.map((L) => ({
            title: L.title.trim(),
            type: L.type,
            durationMin:
              L.durationMin === "" ? null : Number(L.durationMin),
            contentUrl: L.contentUrl.trim(),
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
                    onChange={(e) =>
                      setDescription(e.target.value)
                    }
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
                          onClick={() => addLesson(si)}
                        >
                          + Lesson
                        </button>
                        <button
                          className="mini danger"
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
                          <select
                            className="ls-type"
                            value={ls.type}
                            onChange={(e) =>
                              setLesson(si, li, {
                                type: e.target.value,
                              })
                            }
                          >
                            {LESSON_TYPES.map((t) => (
                              <option key={t.key} value={t.key}>
                                {t.name}
                              </option>
                            ))}
                          </select>

                          <input
                            className="ls-dur"
                            type="number"
                            min="0"
                            placeholder="min"
                            value={ls.durationMin ?? ""}
                            onChange={(e) =>
                              setLesson(si, li, {
                                durationMin: e.target.value,
                              })
                            }
                          />

                          <div className="ls-resource">
                            <input
                              className="ls-url"
                              placeholder="Content URL / document / slide link"
                              value={ls.contentUrl}
                              onChange={(e) =>
                                setLesson(si, li, {
                                  contentUrl: e.target.value,
                                })
                              }
                            />
                            <div className="ls-file-actions">
                              <label className="mini">
                                Upload document / slide
                                <input
                                  type="file"
                                  accept=".pdf,.doc,.docx,.txt,.ppt,.pptx"
                                  style={{ display: "none" }}
                                  onChange={(e) => {
                                    const file =
                                      e.target.files &&
                                      e.target.files[0];
                                    if (file) {
                                      handleLessonFileChange(
                                        si,
                                        li,
                                        file
                                      );
                                      // reset input để chọn lại cùng 1 file nếu cần
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
                              {ls.contentUrl && (
                                <button
                                  type="button"
                                  className="mini danger"
                                  onClick={() =>
                                    setLesson(si, li, {
                                      contentUrl: "",
                                    })
                                  }
                                >
                                  Remove file
                                </button>
                              )}
                            </div>
                          </div>

                          <button
                            className="mini danger"
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
                <button className="ghost-btn" onClick={addSection}>
                  + Add Section
                </button>
                <button
                  className="primary-btn"
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
