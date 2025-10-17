import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { toAbsolute } from "../utils/url";
import "../css/InstructorDashboard.css";

const TABS = [
  { key: "tests", label: "My Tests" },
  { key: "courses", label: "My Courses" },
];

const SUBJECTS = [
  { key: "all", name: "All subjects" },
  { key: "math", name: "Mathematics" },
  { key: "english", name: "English" },
  { key: "physics", name: "Physics" },
  { key: "chemistry", name: "Chemistry" },
];

export default function InstructorDashboard() {
  const [tab, setTab] = useState("tests");
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [subj, setSubj] = useState("all");
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  // fetch my tests when tab=tests
  const fetchTests = async () => {
    setLoading(true);
    try {
      const url = toAbsolute(`/api/tests?mine=1`);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setTests(data || []);
    } catch (e) {
      setToast({ type: "error", msg: `Load failed: ${e.message}` });
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  useEffect(() => {
    if (tab === "tests") fetchTests();
  }, [tab]);

  const filteredTests = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tests.filter(t => {
      const okSubj = subj === "all" || t.subject === subj;
      if (!term) return okSubj;
      const hay = `${t.title} ${t.description || ""} ${(t.tags||[]).join(" ")} ${t.grade || ""}`.toLowerCase();
      return okSubj && hay.includes(term);
    });
  }, [tests, q, subj]);

  const onDelete = async (id) => {
    if (!window.confirm("Delete this test permanently?")) return;
    try {
      const res = await fetch(toAbsolute(`/api/tests/${id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      setToast({ type: "success", msg: "Deleted." });
      setTests(prev => prev.filter(x => String(x._id) !== String(id)));
    } catch (e) {
      setToast({ type: "error", msg: `Delete failed: ${e.message}` });
    } finally {
      setTimeout(() => setToast(null), 4000);
    }
  };

  return (
    <div className="teacher-page">
      <SiteHeader />

      <main className="teacher-container">
        <div className="dash-top">
          <h1 className="pg-title">Instructor Dashboard</h1>

          <div className="tabs-row">
            {TABS.map(t => (
              <button
                key={t.key}
                className={`tab ${tab === t.key ? "active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Toolbar per tab */}
        {tab === "tests" && (
          <div className="bar">
            <div className="bar-left">
              <div className="search">
                <i className="bi bi-search" />
                <input
                  placeholder="Search your tests…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <select
                className="sel"
                value={subj}
                onChange={(e) => setSubj(e.target.value)}
              >
                {SUBJECTS.map(s => (
                  <option key={s.key} value={s.key}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="bar-right">
              <button
                className="primary-btn"
                onClick={() => navigate("/instructor/tests/new")}
              >
                <i className="bi bi-plus-lg" /> Add New Test
              </button>
            </div>
          </div>
        )}

        {tab === "courses" && (
          <div className="bar">
            <div />
            <div className="bar-right">
              <button
                className="ghost-btn"
                onClick={() => navigate("/instructor/courses/new")}
                title="Not implemented yet"
              >
                <i className="bi bi-plus-lg" /> Add New Course
              </button>
            </div>
          </div>
        )}

        {/* Content per tab */}
        {tab === "tests" && (
          <section className="list-wrap">
            {loading ? (
              <div className="empty">Loading…</div>
            ) : filteredTests.length === 0 ? (
              <div className="empty">
                No tests found. Click <b>Add New Test</b> to create one.
              </div>
            ) : (
              <div className="cards">
                {filteredTests.map(t => (
                  <article key={t._id} className="tcard">
                    <div className="tcard-main">
                      <h3 className="t-title">{t.title}</h3>
                      {t.description && (
                        <p className="t-desc" title={t.description}>{t.description}</p>
                      )}
                      <div className="t-meta">
                        <span className="chip">{(t.subject||"").toUpperCase()}</span>
                        {t.grade && <span className="chip">Grade {t.grade}</span>}
                        <span className="chip">{t.numQuestions} Qs</span>
                        {Array.isArray(t.tags) && t.tags.map((tg, i) => (
                          <span className="tag" key={i}>{tg}</span>
                        ))}
                      </div>
                    </div>

                    <div className="tcard-actions">
                      <button
                        className="ghost-btn-edit"
                        onClick={() => navigate(`/instructor/tests/${t._id}/edit`)}
                      >
                        <i className="bi bi-pencil-square" /> Edit
                      </button>
                      <button
                        className="danger-btn"
                        onClick={() => onDelete(t._id)}
                      >
                        <i className="bi bi-trash-fill" /> Delete
                      </button>
                    </div>

                    <div className="tcard-foot">
                      <span className="muted">Updated {new Date(t.updatedAt).toLocaleString()}</span>
                      <span className="dot">•</span>
                      <span className="muted">Created {new Date(t.createdAt).toLocaleDateString()}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "courses" && (
          <section className="list-wrap">
            <div className="empty">
              Courses tab is not implemented yet. Click <b>Add New Course</b> to start (placeholder).
            </div>
          </section>
        )}
      </main>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      <SiteFooter />
    </div>
  );
}
