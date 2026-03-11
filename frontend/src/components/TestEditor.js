import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { toAbsolute } from "../utils/url";
import FormulaEditor from "./FormulaEditor";
import "../css/TestEditor.css";

// ==== Constants & Configurations ====

// Predefined list of subjects for the test categorization
const SUBJECTS = [
  { key: "math", name: "Mathematics" },
  { key: "english", name: "English" },
  { key: "physics", name: "Physics" },
  { key: "chemistry", name: "Chemistry" },
];

// Default difficulty tags available for quick selection
const DIFFICULTY_TAGS = ["Easy", "Medium", "Hard"];

// Supported question types in the test builder dropdowns
const Q_TYPES = [
  { key: "mcq", label: "Multiple choice" },
  { key: "boolean", label: "True / False" },
  { key: "short_answer", label: "Short Answer (Fill in)" },
  { key: "essay", label: "Essay (AI Graded)" },
];

/**
 * Factory function to generate a default, empty question object.
 * Initializes with the Multiple Choice (mcq) format by default to speed up creation.
 * @param {Number} i - The index of the question (used for the default placeholder stem).
 * @returns {Object} A fresh, schema-compliant question object.
 */
const emptyQuestion = (i) => ({
  type: "mcq",                // Defaults to 'mcq', can be 'boolean', 'short_answer', or 'essay'
  stem: `Question ${i + 1} content`,
  
  // Fields specific to Multiple Choice Questions (MCQ)
  choices: ["", "", "", ""],
  correctIndex: null,         // Number from 0 to 3 representing A, B, C, or D

  // Field specific to True/False Questions
  correctBool: null,          // Boolean: true | false
  
  // Field specific to Essay & Short Answer Questions
  modelAnswer: "",

  // Universal field for all question types
  explanation: "",
});

// ==== Main Component ====

/**
 * TestEditor Component
 * The main interface for instructors to create new tests or edit existing ones.
 * Manages test metadata, dynamic question lists, and rich-text/formula inputs.
 */
export default function TestEditor() {
  // ---- Routing & Context ----
  const { id } = useParams();
  const isEdit = Boolean(id); // Determines if we are editing an existing test (PATCH) or creating a new one (POST)
  const navigate = useNavigate();

  // ---- Test Metadata States ----
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0].key);
  const [tags, setTags] = useState([]);
  const [description, setDescription] = useState("");

  // ---- Questions State ----
  const [numQuestions, setNumQuestions] = useState(10); // Determines the length of the questions array
  const [questions, setQuestions] = useState(() =>
    // Initialize array with 10 empty question objects by default
    Array.from({ length: 10 }, (_, i) => emptyQuestion(i))
  );

  // ---- UI & Process States ----
  const [saving, setSaving] = useState(false);        // Disables save button during API call
  const [toast, setToast] = useState(null);           // Manages success/error popup notifications
  const [loading, setLoading] = useState(false);      // Controls loading spinner during initial data fetch
  const [newTagInput, setNewTagInput] = useState(""); // Holds the value for manually typed custom tags

  // ==== Lifecycle Hooks ====

  // Scroll to the top of the page on initial render for better UX
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // Fetch existing test data if the component mounts in Edit Mode
  useEffect(() => {
    if (!isEdit) return;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(toAbsolute(`/api/tests/${id}`), { credentials: "include" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.message || `HTTP ${res.status}`);
        }
        const t = await res.json();

        // Populate test metadata from database
        setTitle(t.title || "");
        setGrade(t.grade || "");
        setSubject(t.subject || SUBJECTS[0].key);
        setTags(t.tags || []);
        setDescription(t.description || "");

        // Map and normalize questions from the database to match frontend state structure
        const qs = (Array.isArray(t.questions) ? t.questions : []).map((q, i) => {
          const type = q.type || "mcq";
          return {
            type,
            stem: q.stem || `Question ${i + 1} content`,
            // Ensure choices array always has exactly 4 items for MCQ
            choices: type === "mcq"
              ? (Array.isArray(q.choices) && q.choices.length === 4 ? q.choices : ["", "", "", ""])
              : ["", "", "", ""],
            correctIndex: type === "mcq" && Number.isInteger(q.correctIndex) ? q.correctIndex : null,
            correctBool: type === "boolean" && typeof q.correctBool === "boolean" ? q.correctBool : null,
            modelAnswer: (type === "essay" || type === "short_answer") ? (q.modelAnswer || "") : "",
            explanation: q.explanation || "",
          };
        });

        // Inject fetched questions into state, fallback to empty templates if array is empty
        setQuestions(qs.length ? qs : Array.from({ length: 10 }, (_, i) => emptyQuestion(i)));
        setNumQuestions(qs.length || 10);
      } catch (e) {
          setToast({ type: "error", msg: `Load failed: ${e.message}` });
      } finally {
          setLoading(false);
          setTimeout(() => setToast(null), 4000);   // Auto-hide error toast
      }
    })();
  }, [isEdit, id]);

  // Synchronize the `questions` array length with the `numQuestions` input state
  useEffect(() => {
    // Keep number of questions between 1 and 200 to prevent performance issues/browser crashing
    const n = Math.max(1, Math.min(200, Number(numQuestions) || 1));
    
    setQuestions((prev) => {
      const next = [...prev];
      if (next.length < n) {
        // If the number increased, append new empty question templates to the end
        for (let i = next.length; i < n; i++) next.push(emptyQuestion(i));
      } else if (next.length > n) {
        // If the number decreased, slice the array to remove excess items from the end
        next.length = n;
      }
      // Return a shallow copy of each object to properly trigger React re-renders
      return next.map((q) => ({ ...q })); 
    });
  }, [numQuestions]);

  // ==== Tag Management Handlers ====

  /**
   * Toggles a predefined tag on click. Removes it if it exists, adds it if it doesn't.
   */
  const toggleTag = (t) =>
    setTags((arr) => (arr.includes(t) ? arr.filter((x) => x !== t) : [...arr, t]));

  /**
   * Handles adding a custom tag from the input field.
   * Triggered by pressing the 'Enter' key or clicking the "Add Tag" button.
   */
    const handleAddCustomTag = (e) => {
    // Prevent default form submission if triggered via Enter key inside the form
    if (e.key === 'Enter' || e.type === 'click') {
      e.preventDefault();
      const newTag = newTagInput.trim();
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setNewTagInput(""); // Clear the input field after successful addition
    }
  };

  // ==== Question Data Mutation Handlers ====

  // Updates the main text/content (stem) of a specific question
  const onChangeStem = (qi, val) =>
    setQuestions((prev) => {
      const n = [...prev];
      n[qi] = { ...n[qi], stem: val };
      return n;
    });

  /** * Changes the question type and cleans up residual data from previous types.
   * This prevents corrupted payloads (e.g., an MCQ accidentally storing a boolean answer).
   */
  const onChangeQType = (qi, type) =>
    setQuestions((prev) => {
      const n = [...prev];
      const base = { ...n[qi], type };
      
      // Hard reset fields depending on the newly selected type to avoid data leakage
      if (type === "mcq") {
        base.choices = base.choices?.length === 4 ? [...base.choices] : ["", "", "", ""];
        base.correctIndex = null;
        base.correctBool = null;
        base.modelAnswer = "";
      } else if (type === "boolean") {
        base.correctBool = null;
        base.correctIndex = null;
        base.modelAnswer = "";
      } else if (type === "short_answer") {
        base.correctBool = null;
        base.correctIndex = null;
        base.modelAnswer = base.modelAnswer || "";
      } else if (type === "essay") {
        base.modelAnswer = base.modelAnswer || "";
        base.correctIndex = null;
        base.correctBool = null;
      }
      n[qi] = base;
      return n;
    });

  // Updates a specific choice text for an MCQ question
  const onChangeChoice = (qi, ci, val) =>
    setQuestions((prev) => {
      const n = [...prev];
      // Deep copy the choices array to prevent state mutation bugs
      const q = { ...n[qi], choices: [...(n[qi].choices || ["", "", "", ""])] };
      q.choices[ci] = val;
      n[qi] = q;
      return n;
    });

  // Sets the correct answer index (0-3) for an MCQ question
  const onChangeCorrectIndex = (qi, idx) =>
    setQuestions((prev) => {
      const n = [...prev];
      n[qi] = { ...n[qi], correctIndex: idx };
      return n;
    });

  // Sets the correct boolean value (true/false) for a True/False question
  const onChangeBool = (qi, boolVal) =>
    setQuestions((prev) => {
      const n = [...prev];
      n[qi] = { ...n[qi], correctBool: boolVal };
      return n;
    });

  // Updates the model answer text for Short Answer (exact match) or Essay (AI reference)
  const onChangeModelAnswer = (qi, val) =>
    setQuestions((prev) => {
      const n = [...prev];
      n[qi] = { ...n[qi], modelAnswer: val };
      return n;
    });

  // Updates the post-submission explanation text (used across all question types)
  const onChangeExplain = (qi, val) =>
    setQuestions((prev) => {
      const n = [...prev];
      n[qi] = { ...n[qi], explanation: val };
      return n;
    });

  // ==== Validation & Submission ====

  /**
   * Validates the entire test form before allowing a network request.
   * Checks for required metadata and validates each question strictly based on its type.
   * @returns {String|null} Error message string if invalid, or null if perfectly valid.
   */
  const validate = () => {
    // Check global metadata
    if (!title.trim()) return "Please enter a test title.";
    if (!grade.toString().trim()) return "Please enter a grade/level.";
    if (!subject) return "Please select a subject.";
    if (questions.length < 1) return "Please add at least 1 question.";

    // Validate individual questions based on their selected type
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.stem || !q.stem.trim()) return `Question ${i + 1}: stem is required.`;

      if (q.type === "mcq") {
        // Validate all 4 choices are filled
        for (let j = 0; j < 4; j++) {
          if (!q.choices[j] || !q.choices[j].trim())
            return `Question ${i + 1}: choice ${String.fromCharCode(65 + j)} is empty.`;
        }
        // Validate an answer was selected
        if (!Number.isInteger(q.correctIndex))
          return `Question ${i + 1}: please select the correct answer.`;
      } else if (q.type === "boolean") {
        if (typeof q.correctBool !== "boolean")
          return `Question ${i + 1}: please choose True or False.`;
      } else if (q.type === "short_answer") {
        if (!q.modelAnswer || !q.modelAnswer.trim())
          return `Question ${i + 1}: please provide the exact correct answer for auto-grading.`;
      } else if (q.type === "essay") {
        // modelAnswer/rubric is optional for essays, so no strict validation needed here
      }
    }
    return null;
  };

  /**
   * Formats the payload, strips out unneeded whitespace, and sends it to the API 
   * to either create a new test or patch an existing one.
   */
  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setToast({ type: "error", msg: err });
      return;
    }

    setSaving(true);
    try {
      // Deep normalize payload to ensure perfectly clean data is sent to the backend.
      // This prevents submitting empty fields that belong to other question types.
      const qs = questions.map((q) => {
        if (q.type === "mcq") {
          return {
            type: "mcq",
            stem: q.stem.trim(),
            choices: q.choices.map((c) => c.trim()),
            correctIndex: q.correctIndex,
            explanation: q.explanation?.trim() || "",
          };
        }
        if (q.type === "boolean") {
          return {
            type: "boolean",
            stem: q.stem.trim(),
            correctBool: !!q.correctBool,
            explanation: q.explanation?.trim() || "",
          };
        }
        if (q.type === "short_answer") {
          return { 
            type: "short_answer", 
            stem: q.stem.trim(), 
            modelAnswer: (q.modelAnswer || "").trim(), 
            explanation: q.explanation?.trim() || "" 
          };
        }
        return {
          type: "essay",
          stem: q.stem.trim(),
          modelAnswer: (q.modelAnswer || "").trim(),
          explanation: q.explanation?.trim() || "",
        };
      });

      const payload = {
        title: title.trim(),
        grade: grade.toString().trim(),
        subject,
        tags,
        description,
        numQuestions: qs.length,
        questions: qs,
      };

      const url = isEdit ? toAbsolute(`/api/tests/${id}`) : toAbsolute(`/api/tests`);
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

      // Redirect back to the instructor dashboard after a brief delay
      setTimeout(() => navigate("/instructor"), 600);
    } catch (e) {
      setToast({ type: "error", msg: `Save failed: ${e.message}` });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  // ==== Inline Sub-components ====

  /**
   * Component to dynamically render the correct input fields
   * based on the selected question type (MCQ, True/False, Short Answer, or Essay).
   */
  const QuestionBody = ({ q, qi }) => {
    // ---- MCQ Renderer ----
    if (q.type === "mcq") {
      return (
        <div className="choices">
          {[0, 1, 2, 3].map((ci) => (
            <label key={ci} className="choice-row">
              <input
                type="radio"
                name={`correct-${qi}`}
                checked={q.correctIndex === ci}
                onChange={() => onChangeCorrectIndex(qi, ci)}
                aria-label={`Mark choice ${String.fromCharCode(65 + ci)} as correct`}
              />
              <span className="choice-idx">{String.fromCharCode(65 + ci)}.</span>
              <input
                value={q.choices[ci]}
                onChange={(e) => onChangeChoice(qi, ci, e.target.value)}
                placeholder={`Choice ${String.fromCharCode(65 + ci)}`}
              />
            </label>
          ))}
        </div>
      );
    }

    // ---- True/False Renderer ----
    if (q.type === "boolean") {
      return (
        <div className="tf-row">
          <label className="chip-radio">
            <input
              type="radio"
              name={`tf-${qi}`}
              checked={q.correctBool === true}
              onChange={() => onChangeBool(qi, true)}
            />
            <span>True</span>
          </label>
          <label className="chip-radio">
            <input
              type="radio"
              name={`tf-${qi}`}
              checked={q.correctBool === false}
              onChange={() => onChangeBool(qi, false)}
            />
            <span>False</span>
          </label>
        </div>
      );
    }

    // ---- Short Answer Renderer ----
    if (q.type === "short_answer") {
      return (
        <label className="q-row">
          <span style={{ fontWeight: '800', marginBottom: '6px', display: 'block' }}>Correct Answer (Exact Match)</span>
          <input
            type="text"
            value={q.modelAnswer}
            onChange={(e) => onChangeModelAnswer(qi, e.target.value)}
            placeholder="E.g., 132 or Apple..."
            style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-input)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '15px', outline: 'none' }}
          />
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
            <i className="bi bi-info-circle-fill"></i> Students must type exactly this text to get points (case-insensitive).
          </div>
        </label>
      );
    }
    
    // ---- Essay Renderer (Default Fallback) ----
    return (
      <label className="q-row">
        <span>Sample answer / Rubric (optional)</span>
        <textarea
          rows={3}
          value={q.modelAnswer}
          onChange={(e) => onChangeModelAnswer(qi, e.target.value)}
          placeholder="Provide a model answer or scoring rubric…"
        />
      </label>
    );
  };

  // ==== Render ====

  return (
    <div className="teacher-page">
      <SiteHeader />
      <main className="teacher-container">
        <h1 className="pg-title">{isEdit ? "Edit Test" : "Create Test"}</h1>

        {loading ? (
          <div className="empty">Loading…</div>
        ) : (
          <>
            {/* ---- Test Metadata Section ---- */}
            <section className="card">
              <h3>Test information</h3>
              <div className="form-grid">
                <label className="form-row">
                  <span>Test title</span>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} />
                </label>

                <label className="form-row">
                  <span>Grade</span>
                  <input value={grade} onChange={(e) => setGrade(e.target.value)} />
                </label>

                <label className="form-row">
                  <span>Subject</span>
                  <select value={subject} onChange={(e) => setSubject(e.target.value)}>
                    {SUBJECTS.map((s) => (
                      <option key={s.key} value={s.key}>{s.name}</option>
                    ))}
                  </select>
                </label>

                {/* Tags Configuration */}
                <div className="form-row">
                  <span>Tags</span>
                  <div className="tags-input-container">
                    <div className="chips" style={{ marginBottom: '10px', flexWrap: 'wrap', display: 'flex', gap: '8px' }}>
                      {/* Default difficulty tags */}
                      {DIFFICULTY_TAGS.map((t) => (
                        <button
                          type="button"
                          key={t}
                          className={`chip ${tags.includes(t) ? "active" : ""}`}
                          onClick={() => toggleTag(t)}
                        >
                          {t}
                        </button>
                      ))}
                      
                      {/* Custom tags manually added by the instructor */}
                      {tags.filter(t => !DIFFICULTY_TAGS.includes(t)).map(t => (
                        <span key={t} className="chip active" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#e2e8f0', color: '#334155', borderColor: '#cbd5e1' }}>
                          {t} 
                          <i className="bi bi-x-circle-fill" style={{cursor: 'pointer', color: '#94a3b8'}} onClick={() => toggleTag(t)}></i>
                        </span>
                      ))}
                    </div>

                    {/* Input field for adding new custom tags */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Add custom tag (e.g. Midterm, Algebra...) and press Enter"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={handleAddCustomTag}
                        style={{ flex: 1 }}
                      />
                      <button type="button" className="ghost-btn" onClick={handleAddCustomTag}>
                        Add Tag
                      </button>
                    </div>
                  </div>
                </div>

                <label className="form-row full">
                  <span>Description</span>
                  <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                </label>

                <label className="form-row">
                  <span>Number of questions</span>
                  <input
                    type="number" min={1} max={200}
                    value={numQuestions} onChange={(e) => setNumQuestions(e.target.value)}
                  />
                </label>

                <div className="form-row">
                  <span>Test time for students</span>
                  <div className="readonly">
                    Students choose: <b>Unlimited</b>, <b>45m</b>, <b>50m</b>, <b>60m</b>.
                  </div>
                </div>
              </div>
            </section>

            {/* ---- Questions Builder Section ---- */}
            <section className="card">
              <h3>Questions</h3>

              <div className="q-list">
                {questions.map((q, qi) => (
                  <div key={qi} className="q-card">

                    {/* Question Header: Number and Type Selector */}
                    <div className="q-head">
                      <span className="q-no">Q{qi + 1}</span>
                      <select
                        className="qtype-select"
                        value={q.type}
                        onChange={(e) => onChangeQType(qi, e.target.value)}
                        aria-label="Question type"
                      >
                        {Q_TYPES.map((t) => (
                          <option key={t.key} value={t.key}>{t.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Content: Main Question Stem via FormulaEditor */}
                    <div className="q-row">
                      <span style={{ fontWeight: '800', marginBottom: '6px', display: 'block' }}>Question Content</span>
                      <FormulaEditor
                        value={q.stem}
                        onChange={(val) => onChangeStem(qi, val)}
                        placeholder="Type question content (click Insert Formula for math)..."
                      />
                    </div>

                    {/* Answers: Dynamic Inputs based on type (MCQ / TF / Short / Essay) */}
                    <QuestionBody q={q} qi={qi} />

                    {/* Optional Post-Submission Explanation */}
                    <div className="q-row" style={{ marginTop: '15px' }}>
                      <span style={{ fontWeight: '800', marginBottom: '6px', display: 'block' }}>Explanation (Optional)</span>
                      <FormulaEditor
                        value={q.explanation}
                        onChange={(val) => onChangeExplain(qi, val)}
                        placeholder="Explain with text or formulas..."
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Form Action Buttons */}
              <div className="actions">
                <button className="ghost-btn" onClick={() => navigate("/instructor")}>Cancel</button>
                <button className="primary-btn" disabled={saving} onClick={handleSubmit}>
                  {/* Change text based on moderation workflow */}
                  {saving ? "Submitting..." : (isEdit ? "Update & Submit for Review" : "Submit for Review")}
                </button>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Global Toast Notification */}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      
      <SiteFooter />
    </div>
  );
}