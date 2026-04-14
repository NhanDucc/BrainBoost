import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { useUser } from "../context/UserContext";
import { api } from "../api";
import "../css/CourseEditor.css";

// ==== Constants & Helper Functions ====

// Predefined list of subjects for course categorization
const SUBJECTS = [
  { key: "math", name: "Mathematics" },
  { key: "english", name: "English" },
  { key: "physics", name: "Physics" },
  { key: "chemistry", name: "Chemistry" },
];

// Supported content types within a course section
const LESSON_TYPES = [
  { key: "lesson", name: "Lesson" },
  { key: "quiz", name: "Quiz" },
];

// Allowed file extensions for document/presentation uploads
const LESSON_FILE_EXTS = [".pdf", ".doc", ".docx", ".txt", ".ppt", ".pptx"];

// Validates if a string is a proper MongoDB ObjectId (24-character hex)
const isMongoId = (val) => typeof val === "string" && /^[0-9a-fA-F]{24}$/.test(val);

/**
 * Factory function to generate a fresh, default lesson object.
 * Maps exactly to the expected backend Lesson schema.
 */
const emptyLesson = () => ({
  title: "", type: "lesson", durationMin: "", contentUrl: "", originalDocUrl: "", originalDocType: "",
  aiSlides: [], useAiSlides: false, showOriginalToStudents: true,
});

/**
 * Factory function to generate a new section containing one default lesson.
 */
const emptySection = (i) => ({ title: `Section ${i + 1}`, lessons: [emptyLesson()] });

// ==== Main Component ====

/**
 * CourseEditor Component
 * Complex form interface allowing instructors/admins to create or edit courses,
 * manage deeply nested curriculum structures (sections -> lessons), upload files, 
 * and trigger AI slide generation.
 */
export default function CourseEditor() {
  const { user } = useUser();
  const { id } = useParams(); // Extracts the course ID from the URL (if editing)
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  
  // Role-Based Access Control (RBAC): Only admins and instructors can access this editor
  const canEdit = user && (user.role === "admin" || user.role === "instructor");

  // Identifies if an Admin is viewing this page in "Read-Only Preview Mode"
  const isAdminReview = user?.role === "admin";

  // ---- UI & Network States ----
  const [loading, setLoading] = useState(isEdit); // Show loading skeleton only if editing
  const [saving, setSaving] = useState(false);    // Disables inputs during API submission
  const [toast, setToast] = useState(null);       // Manages success/error popup notifications

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
  const [courseVisibility, setCourseVisibility] = useState("draft"); // Moderation status

  // ---- Curriculum Builder States ----
  const [sections, setSections] = useState([emptySection(0)]);
  const [uploadingLesson, setUploadingLesson] = useState(null); // Tracks specific lesson index uploading a file
  const [aiGeneratingLesson, setAiGeneratingLesson] = useState(null); // Tracks specific lesson generating AI slides

  // Scroll to the top of the page on initial render
  useEffect(() => { window.scrollTo(0, 0); }, []);

  /**
   * Helper function to populate all form states with data.
   * Extracted to be used by both the Cache retrieval and the API fetch.
   * @param {Object} c - Course object from backend or cache.
   */
  const populateForm = (c) => {
    setTitle(c.title || "");
    setSlug(c.slug || "");
    setSubject(c.subject || SUBJECTS[0].key);
    setGrade(c.grade || "");
    setTags(Array.isArray(c.tags) ? c.tags : []);
    setPrice(c.price ?? "");
    setDescription(c.description || "");
    setCoverUrl(c.coverUrl || "");
    setLearn(Array.isArray(c.learn) && c.learn.length > 0 ? c.learn : ["", "", "", ""]);
    setCourseVisibility(c.visibility || "draft");

    // Normalize deeply nested sections and lessons arrays
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
              showOriginalToStudents: typeof ls.showOriginalToStudents === "boolean" ? ls.showOriginalToStudents : true,
            })),
          }))
        : [emptySection(0)]
    );
  };

  // ==== Caching & Data Fetching (Edit Mode Only) ====
  
  useEffect(() => {
    if (!isEdit) return;

    let cancelled = false; // Prevents memory leaks if component unmounts
    
    const fetchCourse = async () => {
      const cacheKey = `course_edit_v1_${id}`;
      const cached = sessionStorage.getItem(cacheKey);

      // 1. Cache-First Strategy: Display cached data instantly to prevent loading screens
      if (cached) {
        populateForm(JSON.parse(cached));
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        const res = await api.get(`/courses/${id}`);
        
        // 2. Silently update the cache in the background with fresh server data
        sessionStorage.setItem(cacheKey, JSON.stringify(res.data));
        
        // 3. Only populate the form from the network if no cache was used.
        // This prevents overwriting text the instructor might have started typing.
        if (!cached && !cancelled) {
          populateForm(res.data);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled && !cached) {
          setToast({ type: "error", msg: `Load failed: ${e.response?.data?.message || e.message}` });
          setLoading(false);
        }
      }
    };

    fetchCourse();
    return () => { cancelled = true; };
  }, [isEdit, id]);

  // ==== Curriculum Builder Operations ====
  // Uses immutable state updates (spread operators) to ensure React re-renders correctly.

  const addSection = () => setSections((prev) => [...prev, emptySection(prev.length)]);
  const removeSection = (si) => setSections((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== si));
  const changeSectionTitle = (si, val) => setSections((prev) => { const n = [...prev]; n[si] = { ...n[si], title: val }; return n; });
  const addLesson = (si) => setSections((prev) => { const n = [...prev]; n[si] = { ...n[si], lessons: [...n[si].lessons, emptyLesson()] }; return n; });
  const removeLesson = (si, li) => setSections((prev) => { const n = [...prev]; const list = [...n[si].lessons]; if (list.length === 1) return prev; list.splice(li, 1); n[si] = { ...n[si], lessons: list }; return n; });
  const setLesson = (si, li, patch) => setSections((prev) => { const n = [...prev]; const list = [...n[si].lessons]; list[li] = { ...list[li], ...patch }; n[si] = { ...n[si], lessons: list }; return n; });

  // ==== External Operations (Upload, Generate AI, Submit, Clone) ====

  /**
   * Handles uploading a document (PDF, Word, PPT) to the backend.
   */
  const handleLessonFileChange = async (si, li, file) => {
    if (!file) return;
    
    // Validate file extension locally
    const lowerName = file.name.toLowerCase();
    if (!LESSON_FILE_EXTS.some((ext) => lowerName.endsWith(ext))) {
      setToast({ type: "error", msg: "Only PDF, Word, text, or slide (PPT/PPTX) files are allowed." });
      setTimeout(() => setToast(null), 3500); return;
    }

    try {
      setUploadingLesson(`${si}-${li}`); // Show loading indicator on specific lesson
      
      const fd = new FormData(); 
      fd.append("file", file);
      const res = await api.post("/courses/upload-doc", fd);
      
      const { url, mimeType } = res.data;
      const mime = (mimeType || file.type || "").toLowerCase();
      
      // Determine standardized document type for the frontend viewer
      let docType = "";
      if (mime.includes("pdf")) docType = "pdf";
      else if (mime.includes("word") || mime.includes("officedocument.wordprocessingml.document")) docType = "docx";
      else if (mime.includes("presentation") || mime.includes("powerpoint")) docType = "pptx";

      // Update lesson state with Cloudinary URLs
      setLesson(si, li, { contentUrl: url, originalDocUrl: url, originalDocType: docType });
      setToast({ type: "success", msg: "Document uploaded." });
      setTimeout(() => setToast(null), 2500);
    } catch (e) {
      setToast({ type: "error", msg: `Upload failed: ${e.message}` });
    } finally { setUploadingLesson(null); }
  };

  /**
   * Triggers the AI microservice to read the uploaded document and generate presentation slides.
   */
  const handleGenerateSlides = async (si, li, lesson) => {
    if (!lesson.useAiSlides) return setToast({ type: "error", msg: "Please tick 'Allow AI slides' first." });
    if (!lesson.originalDocUrl) return setToast({ type: "error", msg: "Please upload a document first." });

    const hasValidCourseId = isEdit && id && isMongoId(id);
    try {
      setAiGeneratingLesson(`${si}-${li}`);
      
      // Select endpoint based on whether the course is already saved in the DB
      const endpoint = hasValidCourseId ? `/courses/${id}/sections/${si}/lessons/${li}/gen-slides` : "/ai-slides/generate";
      const payloadObj = hasValidCourseId ? { numSlides: 10 } : { docUrl: lesson.originalDocUrl, maxSlides: 10 };
      
      const res = await api.post(endpoint, payloadObj);
      
      setLesson(si, li, { aiSlides: Array.isArray(res.data.slides) ? res.data.slides : [], useAiSlides: true });
      setToast({ type: "success", msg: `Generated AI slides.` });
    } catch (e) {
      setToast({ type: "error", msg: `Generate failed: ${e.message}` });
    } finally { setAiGeneratingLesson(null); setTimeout(() => setToast(null), 3000); }
  };

  /**
   * Pre-submission validation to ensure required fields are filled.
   */
  const validate = () => {
    if (!canEdit) return "Forbidden";
    if (!title.trim()) return "Please enter course title.";
    if (!grade.toString().trim()) return "Please enter a grade.";
    if (!subject) return "Please select a subject.";
    if (!description.trim()) return "Please enter course description.";
    if (!sections.length) return "Please add at least 1 section.";
    
    // Deep validation for nested curriculum
    for (let i = 0; i < sections.length; i++) {
      if (!sections[i].title.trim()) return `Section ${i + 1}: title required.`;
      if (!sections[i].lessons.length) return `Section ${i + 1}: add at least 1 lesson.`;
      for (let j = 0; j < sections[i].lessons.length; j++) {
        if (!sections[i].lessons[j].title.trim()) return `Sec ${i + 1}, Les ${j + 1}: title required.`;
      }
    }
    return null;
  };

  /**
   * Main submission handler.
   * Prepares the payload and sends it to the API. 
   * @param {String} targetVisibility - Either "draft" or "pending" depending on the button clicked.
   */
  const handleSubmit = async (targetVisibility = "pending") => {
    const err = validate();
    if (err) { setToast({ type: "error", msg: err }); setTimeout(() => setToast(null), 3000); return; }

    setSaving(true);
    try {
      // Construct payload, sanitizing inputs (trimming strings, ensuring numbers)
      const payload = {
        title: title.trim(), slug: slug.trim(), subject, grade: grade.toString().trim(), description, tags, price: price === "" ? null : Number(price), coverUrl,
        learn: learn.map(s => s.trim()).filter(Boolean), visibility: targetVisibility,
        sections: sections.map((s) => ({
          title: s.title.trim(),
          lessons: s.lessons.map((L) => ({
            title: L.title.trim(), type: L.type, durationMin: L.durationMin !== "" ? Number(L.durationMin) : 0, contentUrl: (L.contentUrl || "").trim(),
            originalDocUrl: (L.originalDocUrl || "").trim(), originalDocType: L.originalDocType || "", aiSlides: Array.isArray(L.aiSlides) ? L.aiSlides : [],
            useAiSlides: !!L.useAiSlides, showOriginalToStudents: typeof L.showOriginalToStudents === "boolean" ? L.showOriginalToStudents : true,
          })),
        })),
      };

      const url = isEdit ? `/courses/${id}` : `/courses`;
      if (isEdit) await api.patch(url, payload);
      else await api.post(url, payload);
        
      setToast({ type: "success", msg: targetVisibility === "draft" ? "Draft saved!" : "Submitted for review!" });
      
      // Invalidate the cache for this course so the dashboard reflects the latest changes
      sessionStorage.removeItem(`course_edit_v1_${id}`);
      
      setTimeout(() => navigate("/instructor"), 700);
    } catch (e) {
      setToast({ type: "error", msg: `Save failed: ${e.response?.data?.message || e.message}` });
      setTimeout(() => setToast(null), 4000);
    } finally { setSaving(false); }
  };

  /**
   * Moderation Workflow Feature:
   * Creates a draft clone of a live, published course so instructors can edit it safely 
   * without affecting active students.
   */
  const handleCloneDraft = async () => {
    try {
        setSaving(true);
        const res = await api.post(`/courses/${id}/clone`);
        setToast({ type: "success", msg: "Draft version created! Redirecting..." });
        
        // Fast navigation to the new cloned draft
        navigate(`/instructor/courses/${res.data.id}/edit`);
        setSaving(false);
    } catch(e) { 
      setToast({ type: "error", msg: "Failed to create draft." });
      setSaving(false); 
    }
  };

  // ==== Render ====

  if (!canEdit) return (<div className="course-page"><SiteHeader /><div className="course-container"><div className="empty">Permission Denied</div></div><SiteFooter /></div>);

  /**
   * Skeleton Loading UI
   * Replicates the shape of the editor form to prevent Cumulative Layout Shift (CLS).
   */
  const SkeletonEditor = () => (
    <>
      <section className="card skeleton-card">
        <h3>Course information</h3>
        <div className="form-grid">
          <div className="form-row"><span className="skeleton-text" style={{width:'50px'}}></span><div className="skeleton skeleton-input"></div></div>
          <div className="form-row"><span className="skeleton-text" style={{width:'100px'}}></span><div className="skeleton skeleton-input"></div></div>
          <div className="form-row"><span className="skeleton-text" style={{width:'60px'}}></span><div className="skeleton skeleton-input"></div></div>
          <div className="form-row"><span className="skeleton-text" style={{width:'50px'}}></span><div className="skeleton skeleton-input"></div></div>
          <div className="form-row full"><span className="skeleton-text" style={{width:'80px'}}></span><div className="skeleton skeleton-textarea"></div></div>
          <div className="form-row"><span className="skeleton-text" style={{width:'120px'}}></span><div className="skeleton skeleton-input"></div></div>
          <div className="form-row"><span className="skeleton-text" style={{width:'100px'}}></span><div className="skeleton skeleton-input"></div></div>
          <div className="form-row full"><span className="skeleton-text" style={{width:'150px'}}></span><div className="skeleton skeleton-input"></div></div>
          <div className="form-row full">
              <span className="skeleton-text" style={{width:'120px'}}></span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="skeleton skeleton-input"></div><div className="skeleton skeleton-input"></div>
              </div>
          </div>
        </div>
      </section>
      <section className="card skeleton-card">
          <h3>Curriculum</h3>
          <div className="skeleton skeleton-textarea" style={{height:'80px', marginBottom: '12px'}}></div>
          <div className="sec-card">
              <div className="skeleton skeleton-input" style={{height:'40px', marginBottom:'10px'}}></div>
              <div className="skeleton skeleton-input" style={{height:'80px'}}></div>
          </div>
      </section>
    </>
  );

  return (
    <div className="course-page">
      <SiteHeader />
      <main className="course-container">
        <h1 className="pg-title">{isEdit ? "Edit Course" : "Create Course"}</h1>

        {loading ? ( <SkeletonEditor /> ) : (
          <>
            {/* Metadata Form: Visual opacity is lowered if the course is currently live (Published) */}
            <section className="card" style={{ opacity: (courseVisibility === "published" || isAdminReview) ? 0.6 : 1, pointerEvents: (courseVisibility === "published" || isAdminReview) ? "none" : "auto" }}>
              <h3>Course information</h3>
              <div className="form-grid">
                <label className="form-row"><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
                <label className="form-row"><span>Slug (optional)</span><input placeholder="my-awesome-course" value={slug} onChange={(e) => setSlug(e.target.value)} /></label>
                <label className="form-row"><span>Subject</span><select value={subject} onChange={(e) => setSubject(e.target.value)}>{SUBJECTS.map((s) => (<option key={s.key} value={s.key}>{s.name}</option>))}</select></label>
                <label className="form-row"><span>Grade</span><input value={grade} onChange={(e) => setGrade(e.target.value)} /></label>
                <label className="form-row full"><span>Description</span><textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
                <label className="form-row"><span>Tags (comma separated)</span><input value={tags.join(", ")} onChange={(e) => setTags(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></label>
                <label className="form-row"><span>Price (optional)</span><input type="number" min="0" step="1" placeholder="e.g. 0 or 199" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
                <label className="form-row full"><span>Cover image URL</span><input className="url-input" placeholder="https://…" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} />
                  {coverUrl?.trim() && (<img src={coverUrl} alt="cover" className="cover-preview" style={{maxWidth: '200px'}} />)}
                </label>
                
                {/* Dynamic List for 'What you'll learn' goals */}
                <div className="form-row full">
                  <span>What you'll learn</span>
                  <p style={{fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 8px 0'}}>Add key skills students will gain. Leave input empty to ignore.</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {learn.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                        <input placeholder={`Goal ${idx + 1}`} value={item} onChange={(e) => { const newLearn = [...learn]; newLearn[idx] = e.target.value; setLearn(newLearn); }} style={{ flex: 1 }} />
                        <button type="button" className="mini danger" onClick={() => setLearn(learn.filter((_, i) => i !== idx))}>✕</button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="ghost-btn" style={{ width: 'fit-content', marginTop: '8px' }} onClick={() => setLearn([...learn, ""])}>+ Add more goal</button>
                </div>
              </div>
            </section>

            {/* Curriculum Builder Section */}
            <section className="card">
              <h3>Curriculum</h3>
              <div className="upload-hints">
                <div className="upload-hints-title">Teaching files & AI slides</div>
                <p className="upload-hints-text">Choose <strong>Lesson</strong> or <strong>Quiz</strong>. Upload a PDF/Word/PPT file and let BrainBoost generate AI slides.</p>
              </div>

              {/* Disabled interactions if the course is already published */}
              <div className="sec-list" style={{ opacity: (courseVisibility === "published" || isAdminReview) ? 0.6 : 1, pointerEvents: (courseVisibility === "published" || isAdminReview) ? "none" : "auto" }}>
                {sections.map((sec, si) => (
                  <div key={si} className="sec-card">
                    <div className="sec-head">
                      <input className="sec-title" value={sec.title} onChange={(e) => changeSectionTitle(si, e.target.value) } />
                      <div className="sec-actions">
                        <button className="mini" type="button" onClick={() => addLesson(si)}>+ Lesson</button>
                        <button className="mini danger" type="button" onClick={() => removeSection(si)}>Delete Section</button>
                      </div>
                    </div>

                    <div className="lesson-list">
                      {sec.lessons.map((ls, li) => (
                        <div key={li} className="lesson-row">
                          <span className="ls-idx">{li + 1}.</span>
                          <input className="ls-title" placeholder="Lesson title" value={ls.title} onChange={(e) => setLesson(si, li, { title: e.target.value }) } />
                          <select className="ls-type" value={ls.type} onChange={(e) => setLesson(si, li, { type: e.target.value })}>
                            {LESSON_TYPES.map((t) => (<option key={t.key} value={t.key}>{t.name}</option>))}
                          </select>
                          <input className="ls-dur" type="number" min="0" placeholder="Mins" value={ls.durationMin ?? ""} onChange={(e) => setLesson(si, li, { durationMin: e.target.value }) } />
                          
                          <div className="ls-resource">
                            <div className="lesson-switch-row">
                              <label className="lesson-switch-label"><input type="checkbox" checked={!!ls.showOriginalToStudents} onChange={(e) => setLesson(si, li, { showOriginalToStudents: e.target.checked }) } /><span>Original document access</span></label>
                              <label className="lesson-switch-label"><input type="checkbox" checked={!!ls.useAiSlides} onChange={(e) => setLesson(si, li, { useAiSlides: e.target.checked }) } /><span>Allow AI slides</span></label>
                            </div>
                            
                            {/* File Upload Controls */}
                            <div className="ls-file-actions">
                              <label className="mini">Upload file
                                <input type="file" accept=".pdf,.doc,.docx,.txt,.ppt,.pptx" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleLessonFileChange(si, li, file); e.target.value = ""; }} />
                              </label>
                              {uploadingLesson === `${si}-${li}` && (<span className="ls-uploading">Uploading…</span>)}
                              {(ls.contentUrl || ls.originalDocUrl) && (<button type="button" className="mini danger" onClick={() => setLesson(si, li, { contentUrl: "", originalDocUrl: "", originalDocType: "", aiSlides: [] })}>Remove</button>)}
                            </div>
                            
                            {/* AI Slide Generation Button */}
                            <div className="lesson-ai-actions">
                              <button type="button" className="mini primary" disabled={!ls.originalDocUrl || !ls.useAiSlides || aiGeneratingLesson === `${si}-${li}`} onClick={() => handleGenerateSlides(si, li, ls)}>
                                {aiGeneratingLesson === `${si}-${li}` ? "Generating…" : "Generate AI slides"}
                              </button>
                            </div>
                          </div>
                          
                          <button className="mini danger" type="button" onClick={() => removeLesson(si, li)}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom Action Area: Changes completely based on Moderation Status & Role */}
              {isAdminReview ? (
                  <div className="published-warning-banner" style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1e3a8a' }}>
                      <i className="bi bi-shield-lock-fill"></i>
                      <div>
                          <strong>Admin Preview Mode.</strong><p>This is a read-only view for moderation purposes. You cannot modify the instructor's content.</p>
                      </div>
                  </div>
              ) : courseVisibility === "published" ? (
                  <div className="published-warning-banner">
                      <i className="bi bi-info-circle-fill"></i>
                      <div>
                          <strong>Live Course.</strong><p>Cannot edit directly. Create a draft version to update safely.</p>
                      </div>
                      <button type="button" className="primary-btn" onClick={handleCloneDraft} disabled={saving}>{saving ? "Creating..." : "Create Draft"}</button>
                  </div>
              ) : (
                  <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                      <button className="ghost-btn" type="button" onClick={() => navigate("/instructor")}>Cancel</button>
                      <button className="ghost-btn" type="button" onClick={addSection} disabled={saving}>+ Add Section</button>
                      <button className="ghost-btn" type="button" onClick={() => handleSubmit("draft")} disabled={saving}>{saving ? "..." : "Save as Draft"}</button>
                      <button className="primary-btn" type="button" onClick={() => handleSubmit("pending")} disabled={saving}>{saving ? "Submitting..." : (isEdit ? "Update & Submit" : "Submit for Review")}</button>
                  </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* Global Toast Notification System */}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      <SiteFooter />
    </div>
  );
}