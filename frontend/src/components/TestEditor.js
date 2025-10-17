import React, { useEffect, useMemo, useState } from "react";
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

const emptyQuestion = (i) => ({
  stem: `Question ${i + 1} content`,
  choices: ["", "", "", ""],
  correctIndex: null,
  explanation: "",
});

export default function TestEditor() {
  const { id } = useParams(); // undefined => new
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

  // load existing test
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(toAbsolute(`/api/tests/${id}`), { credentials: "include" });
        if (!res.ok) {
          const data = await res.json().catch(()=> ({}));
          throw new Error(data?.message || `HTTP ${res.status}`);
        }
        const t = await res.json();
        setTitle(t.title || "");
        setGrade(t.grade || "");
        setSubject(t.subject || SUBJECTS[0].key);
        setTags(t.tags || []);
        setDescription(t.description || "");
        setQuestions(
          (t.questions && t.questions.length ? t.questions : Array.from({length:10}, (_,i)=>emptyQuestion(i)))
            .map((q, i) => ({
              stem: q.stem || `Question ${i + 1} content`,
              choices: Array.isArray(q.choices) && q.choices.length === 4 ? q.choices : ["", "", "", ""],
              correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : null,
              explanation: q.explanation || "",
            }))
        );
        setNumQuestions((t.questions && t.questions.length) || 10);
      } catch (e) {
        setToast({ type: "error", msg: `Load failed: ${e.message}` });
      } finally {
        setLoading(false);
        setTimeout(() => setToast(null), 4000);
      }
    })();
  }, [isEdit, id]);

  // keep questions length
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

  const onChangeChoice = (qi, ci, val) =>
    setQuestions((prev) => {
      const next = [...prev];
      const q = { ...next[qi], choices: [...next[qi].choices] };
      q.choices[ci] = val;
      next[qi] = q;
      return next;
    });

  const onChangeStem = (qi, val) =>
    setQuestions((prev) => {
      const next = [...prev];
      next[qi] = { ...next[qi], stem: val };
      return next;
    });

  const onChangeCorrect = (qi, idx) =>
    setQuestions((prev) => {
      const next = [...prev];
      next[qi] = { ...next[qi], correctIndex: idx };
      return next;
    });

  const onChangeExplain = (qi, val) =>
    setQuestions((prev) => {
      const next = [...prev];
      next[qi] = { ...next[qi], explanation: val };
      return next;
    });

  const validate = () => {
    if (!title.trim()) return "Please enter a test title.";
    if (!grade.toString().trim()) return "Please enter a grade/level.";
    if (!subject) return "Please select a subject.";
    if (questions.length < 1) return "Please add at least 1 question.";
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.stem.trim()) return `Question ${i + 1}: stem is required.`;
      for (let j = 0; j < 4; j++) {
        if (!q.choices[j] || !q.choices[j].trim())
          return `Question ${i + 1}: choice ${String.fromCharCode(65 + j)} is empty.`;
      }
      if (q.correctIndex == null)
        return `Question ${i + 1}: please select the correct answer.`;
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      setToast({ type: "error", msg: err });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        grade: grade.toString().trim(),
        subject,
        tags,
        description,
        numQuestions: questions.length,
        questions: questions.map((q) => ({
          stem: q.stem.trim(),
          choices: q.choices.map((c) => c.trim()),
          correctIndex: q.correctIndex,
          explanation: q.explanation?.trim() || "",
        })),
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
      setTimeout(() => {
        navigate("/instructor"); // back to dashboard
      }, 600);
    } catch (e) {
      setToast({ type: "error", msg: `Save failed: ${e.message}` });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
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

            <section className="card">
              <h3>Questions</h3>
              <div className="q-list">
                {questions.map((q, qi) => (
                  <div key={qi} className="q-card">
                    <div className="q-head"><span className="q-no">Q{qi + 1}</span></div>
                    <label className="q-row">
                      <span>Question</span>
                      <textarea rows={2} value={q.stem} onChange={(e) => onChangeStem(qi, e.target.value)} />
                    </label>
                    <div className="choices">
                      {[0, 1, 2, 3].map((ci) => (
                        <label key={ci} className="choice-row">
                          <input
                            type="radio"
                            name={`correct-${qi}`}
                            checked={q.correctIndex === ci}
                            onChange={() => onChangeCorrect(qi, ci)}
                          />
                          <span className="choice-idx">{String.fromCharCode(65 + ci)}.</span>
                          <input
                            value={q.choices[ci]}
                            onChange={(e) => onChangeChoice(qi, ci, e.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                    <label className="q-row">
                      <span>Explanation (optional)</span>
                      <textarea rows={2} value={q.explanation} onChange={(e) => onChangeExplain(qi, e.target.value)} />
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
