import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { toAbsolute } from "../utils/url";
import FormulaEditor from "./FormulaEditor";
import "../css/TestEditor.css";

// ==== Constants & Configurations ====

// List of available subjects for the test
const SUBJECTS = [
  { key: "math", name: "Mathematics" },
  { key: "english", name: "English" },
  { key: "physics", name: "Physics" },
  { key: "chemistry", name: "Chemistry" },
];

// Default difficulty tags available for quick selection
const DIFFICULTY_TAGS = ["Easy", "Medium", "Hard"];

// Supported question types in the test builder
const Q_TYPES = [
  { key: "mcq", label: "Multiple choice" },
  { key: "boolean", label: "True / False" },
  { key: "essay", label: "Essay" },
];

/**
 * Factory function to generate a default, empty question object.
 * Initializes with the Multiple Choice (mcq) format by default.
 * @param {Number} i - The index of the question (used for default placeholder text).
 * @returns {Object} A fresh question object.
 */
const emptyQuestion = (i) => ({
  type: "mcq",                // 'mcq' | 'boolean' | 'essay'
  stem: `Question ${i + 1} content`,
  
  // Fields for MCQ
  choices: ["", "", "", ""],
  correctIndex: null, // 0..3 representing A, B, C, D
  
  // Fields for True/False
  correctBool: null,  // true | false
  
  // Fields for Essay
  modelAnswer: "",
  explanation: "",
});

/**
 * Main component for creating and editing tests.
 * Allows instructors to define test metadata, add custom tags, and build questions.
 */
export default function TestEditor() {
  const { id } = useParams();
  const isEdit = Boolean(id); // Determines if we are editing an existing test or creating a new one
  const navigate = useNavigate();

  // ==== State Management ====

  // Test Metadata State
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0].key);
  const [tags, setTags] = useState([]);
  const [description, setDescription] = useState("");

  // Questions State
  const [numQuestions, setNumQuestions] = useState(10);
  const [questions, setQuestions] = useState(() =>
    Array.from({ length: 10 }, (_, i) => emptyQuestion(i))
  );

  // UI & Loading State
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newTagInput, setNewTagInput] = useState(""); // Input state for custom tags

  // Scroll to the top of the page on initial render
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // ==== Data Fetching (Edit Mode) ====

  /**
   * Fetches the existing test data if the component is in Edit Mode.
   * Populates the state with the retrieved test details and questions.
   */
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

        // Populate test metadata
        setTitle(t.title || "");
        setGrade(t.grade || "");
        setSubject(t.subject || SUBJECTS[0].key);
        setTags(t.tags || []);
        setDescription(t.description || "");

        // Map and normalize questions from the database
        const qs = (Array.isArray(t.questions) ? t.questions : []).map((q, i) => {
          const type = q.type || "mcq";
          return {
            type,
            stem: q.stem || `Question ${i + 1} content`,
            choices: type === "mcq"
              ? (Array.isArray(q.choices) && q.choices.length === 4 ? q.choices : ["", "", "", ""])
              : ["", "", "", ""],
            correctIndex: type === "mcq" && Number.isInteger(q.correctIndex) ? q.correctIndex : null,
            correctBool: type === "boolean" && typeof q.correctBool === "boolean" ? q.correctBool : null,
            modelAnswer: type === "essay" ? (q.modelAnswer || "") : "",
            explanation: q.explanation || "",
          };
        });

        // Set questions or fallback to default empty questions if none exist
        setQuestions(qs.length ? qs : Array.from({ length: 10 }, (_, i) => emptyQuestion(i)));
        setNumQuestions(qs.length || 10);
      } catch (e) {
          setToast({ type: "error", msg: `Load failed: ${e.message}` });
      } finally {
          setLoading(false);
          setTimeout(() => setToast(null), 4000);
      }
    })();
  }, [isEdit, id]);

  // ==== Side Effects ====

  /**
   * Synchronizes the `questions` array length with the `numQuestions` state.
   * If `numQuestions` increases, it appends new empty questions.
   * If it decreases, it truncates the array.
   */
  useEffect(() => {
    const n = Math.max(1, Math.min(200, Number(numQuestions) || 1));
    setQuestions((prev) => {
      const next = [...prev];
      if (next.length < n) {
        // Add new questions
        for (let i = next.length; i < n; i++) next.push(emptyQuestion(i));
      } else if (next.length > n) {
        // Remove excess questions
        next.length = n;
      }
      return next.map((q) => ({ ...q })); // Return a shallow copy to trigger re-render
    });
  }, [numQuestions]);

  // ==== Event Handlers ====

  // Toggles a tag (adds it if missing, removes it if present).
  const toggleTag = (t) =>
    setTags((arr) => (arr.includes(t) ? arr.filter((x) => x !== t) : [...arr, t]));

  /**
   * Handles adding a custom tag from the input field.
   * Triggered by pressing 'Enter' or clicking the add button.
   */
    const handleAddCustomTag = (e) => {
    // Prevent default form submission if triggered via Enter key
    if (e.key === 'Enter' || e.type === 'click') {
      e.preventDefault();
      const newTag = newTagInput.trim();
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setNewTagInput(""); // Clear the input field
    }
  };

  // Updates the question content (stem)
  const onChangeStem = (qi, val) =>
    setQuestions((prev) => {
      const n = [...prev];
      n[qi] = { ...n[qi], stem: val };
      return n;
    });

  /** * Changes the question type and cleans up residual data from previous types 
   * to prevent corrupted payloads (e.g., an MCQ having a boolean answer).
   */
  const onChangeQType = (qi, type) =>
    setQuestions((prev) => {
      const n = [...prev];
      const base = { ...n[qi], type };
      
      // Reset specific fields based on the newly selected type
      if (type === "mcq") {
        base.choices = base.choices?.length === 4 ? [...base.choices] : ["", "", "", ""];
        base.correctIndex = null;
        base.correctBool = null;
        base.modelAnswer = "";
      } else if (type === "boolean") {
        base.correctBool = null;
        base.correctIndex = null;
        base.modelAnswer = "";
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
      const q = { ...n[qi], choices: [...(n[qi].choices || ["", "", "", ""])] };
      q.choices[ci] = val;
      n[qi] = q;
      return n;
    });

  // Sets the correct answer index for an MCQ question
  const onChangeCorrectIndex = (qi, idx) =>
    setQuestions((prev) => {
      const n = [...prev];
      n[qi] = { ...n[qi], correctIndex: idx };
      return n;
    });

  // Sets the correct boolean value for a True/False question
  const onChangeBool = (qi, boolVal) =>
    setQuestions((prev) => {
      const n = [...prev];
      n[qi] = { ...n[qi], correctBool: boolVal };
      return n;
    });

  // Updates the model answer text for an Essay question
  const onChangeModelAnswer = (qi, val) =>
    setQuestions((prev) => {
      const n = [...prev];
      n[qi] = { ...n[qi], modelAnswer: val };
      return n;
    });

  // Updates the explanation text (used across all question types)
  const onChangeExplain = (qi, val) =>
    setQuestions((prev) => {
      const n = [...prev];
      n[qi] = { ...n[qi], explanation: val };
      return n;
    });

  // ===== Validation & Submission =====

  /**
   * Validates the entire test form before submission.
   * Checks for required metadata and validates each question based on its type.
   * @returns {String|null} Error message if invalid, or null if valid.
   */
  const validate = () => {
    if (!title.trim()) return "Please enter a test title.";
    if (!grade.toString().trim()) return "Please enter a grade/level.";
    if (!subject) return "Please select a subject.";
    if (questions.length < 1) return "Please add at least 1 question.";

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.stem || !q.stem.trim()) return `Question ${i + 1}: stem is required.`;

      if (q.type === "mcq") {
        for (let j = 0; j < 4; j++) {
          if (!q.choices[j] || !q.choices[j].trim())
            return `Question ${i + 1}: choice ${String.fromCharCode(65 + j)} is empty.`;
        }
        if (!Number.isInteger(q.correctIndex))
          return `Question ${i + 1}: please select the correct answer.`;
      } else if (q.type === "boolean") {
        if (typeof q.correctBool !== "boolean")
          return `Question ${i + 1}: please choose True or False.`;
      } else if (q.type === "essay") {
        // modelAnswer is optional for essays
      }
    }
    return null;
  };

  /**
   * Formats the payload and sends it to the API to either create or update the test.
   */
  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setToast({ type: "error", msg: err });
      return;
    }

    setSaving(true);
    try {
      // Normalize payload to ensure clean data is sent to the backend
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

  // ===== Render helpers =====

  /**
   * Component to dynamically render the correct input fields
   * based on the selected question type (MCQ, True/False, or Essay).
   */
  const QuestionBody = ({ q, qi }) => {
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

    // Default fallback for 'essay' type
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

  return (
    <div className="teacher-page">
      <SiteHeader />
      <main className="teacher-container">
        <h1 className="pg-title">{isEdit ? "Edit Test" : "Create Test"}</h1>

        {loading ? (
          <div className="empty">Loading…</div>
        ) : (
          <>
            {/* Test Metadata Section */}
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

            {/* Questions Builder Section */}
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

                    {/* Question Stem using FormulaEditor */}
                    <div className="q-row">
                      <span style={{ fontWeight: '800', marginBottom: '6px', display: 'block' }}>Question Content</span>
                      <FormulaEditor
                        value={q.stem}
                        onChange={(val) => onChangeStem(qi, val)}
                        placeholder="Type question content (click Insert Formula for math)..."
                      />
                    </div>

                    {/* Dynamic Question Inputs (MCQ / TF / Essay) */}
                    <QuestionBody q={q} qi={qi} />

                    {/* Question Explanation using FormulaEditor */}
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
                  {saving ? (isEdit ? "Updating…" : "Publishing…") : (isEdit ? "Update" : "Publish test")}
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