import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { toAbsolute } from "../utils/url";
import "../css/TestEditor.css";

const SUBJECTS = [
  { key: "math", name: "Mathematics" },
  { key: "english", name: "English" },
  { key: "physics", name: "Physics" },
  { key: "chemistry", name: "Chemistry" },
];

const DIFFICULTY_TAGS = ["Easy", "Medium", "Hard"];

const Q_TYPES = [
  { key: "mcq", label: "Multiple choice" },
  { key: "boolean", label: "True / False" },
  { key: "essay", label: "Essay" },
];

// Câu mặc định (MCQ)
const emptyQuestion = (i) => ({
  type: "mcq",                // 'mcq' | 'boolean' | 'essay'
  stem: `Question ${i + 1} content`,
  // MCQ
  choices: ["", "", "", ""],
  correctIndex: null,         // 0..3
  // True/False
  correctBool: null,          // true | false
  // Essay
  modelAnswer: "",
  explanation: "",
});

export default function TestEditor() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState(SUBJECTS[0].key);
  const [tags, setTags] = useState([]);
  const [description, setDescription] = useState("");
  const [numQuestions, setNumQuestions] = useState(10);
  const [questions, setQuestions] = useState(() =>
    Array.from({ length: 10 }, (_, i) => emptyQuestion(i))
  );
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  // Load test khi edit
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

        setTitle(t.title || "");
        setGrade(t.grade || "");
        setSubject(t.subject || SUBJECTS[0].key);
        setTags(t.tags || []);
        setDescription(t.description || "");

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

  // Đồng bộ số lượng câu hỏi
  useEffect(() => {
    const n = Math.max(1, Math.min(200, Number(numQuestions) || 1));
    setQuestions((prev) => {
      const next = [...prev];
      if (next.length < n) {
        for (let i = next.length; i < n; i++) next.push(emptyQuestion(i));
      } else if (next.length > n) {
        next.length = n;
      }
      return next.map((q) => ({ ...q }));
    });
  }, [numQuestions]);

  const toggleTag = (t) =>
    setTags((arr) => (arr.includes(t) ? arr.filter((x) => x !== t) : [...arr, t]));

  // ===== Change handlers =====
  const onChangeStem = (qi, val) =>
    setQuestions((prev) => {
      const n = [...prev];
      n[qi] = { ...n[qi], stem: val };
      return n;
    });

  const onChangeQType = (qi, type) =>
    setQuestions((prev) => {
      const n = [...prev];
      const base = { ...n[qi], type };
      // reset fields theo loại
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

  // MCQ
  const onChangeChoice = (qi, ci, val) =>
    setQuestions((prev) => {
      const n = [...prev];
      const q = { ...n[qi], choices: [...(n[qi].choices || ["", "", "", ""])] };
      q.choices[ci] = val;
      n[qi] = q;
      return n;
    });

  const onChangeCorrectIndex = (qi, idx) =>
    setQuestions((prev) => {
      const n = [...prev];
      n[qi] = { ...n[qi], correctIndex: idx };
      return n;
    });

  // True/False
  const onChangeBool = (qi, boolVal) =>
    setQuestions((prev) => {
      const n = [...prev];
      n[qi] = { ...n[qi], correctBool: boolVal };
      return n;
    });

  // Essay
  const onChangeModelAnswer = (qi, val) =>
    setQuestions((prev) => {
      const n = [...prev];
      n[qi] = { ...n[qi], modelAnswer: val };
      return n;
    });

  // Common
  const onChangeExplain = (qi, val) =>
    setQuestions((prev) => {
      const n = [...prev];
      n[qi] = { ...n[qi], explanation: val };
      return n;
    });

  // ===== Validation theo loại =====
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
        // modelAnswer không bắt buộc
      }
    }
    return null;
  };

  // Submit
  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setToast({ type: "error", msg: err });
      return;
    }
    setSaving(true);
    try {
      // Chuẩn hoá payload
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
      setTimeout(() => navigate("/instructor"), 600);
    } catch (e) {
      setToast({ type: "error", msg: `Save failed: ${e.message}` });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  // ===== UI helpers =====
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
    // essay
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
            {/* Meta */}
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

                <div className="form-row">
                  <span>Tags</span>
                  <div className="chips">
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

            {/* Builder */}
            <section className="card">
              <h3>Questions</h3>

              <div className="q-list">
                {questions.map((q, qi) => (
                  <div key={qi} className="q-card">
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

                    <label className="q-row">
                      <span>Question</span>
                      <textarea
                        rows={2}
                        value={q.stem}
                        onChange={(e) => onChangeStem(qi, e.target.value)}
                        placeholder="Write your question..."
                      />
                    </label>

                    {/* Nội dung đáp án theo loại */}
                    <QuestionBody q={q} qi={qi} />

                    <label className="q-row">
                      <span>Explanation (optional)</span>
                      <textarea
                        rows={2}
                        value={q.explanation}
                        onChange={(e) => onChangeExplain(qi, e.target.value)}
                        placeholder="Why is this answer correct? (or hints for essay)"
                      />
                    </label>
                  </div>
                ))}
              </div>

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

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      <SiteFooter />
    </div>
  );
}
