import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { toAbsolute } from "../utils/url";
import "../css/InstructorDashboard.css";

// ==== Constants & Configurations ====

// Defines the available tabs in the dashboard
const TABS = [
  { key: "tests", label: "My Tests" },
  { key: "courses", label: "My Courses" },
];

// Predefined list of subjects for the filter dropdown
const SUBJECTS = [
  { key: "all", name: "All subjects" },
  { key: "math", name: "Mathematics" },
  { key: "english", name: "English" },
  { key: "physics", name: "Physics" },
  { key: "chemistry", name: "Chemistry" },
];

export default function InstructorDashboard() {
  // ==== Navigation State ====
  const [tab, setTab] = useState("tests"); // Tracks the currently active tab

  // ==== Data States ====
  const [tests, setTests] = useState([]);     // Holds the fetched list of tests
  const [courses, setCourses] = useState([]); // Holds the fetched list of courses

  // ==== Shared UI States ====
  const [loading, setLoading] = useState(false); // Controls the loading spinner/text
  const [q, setQ] = useState("");                // Stores the current search query
  const [subj, setSubj] = useState("all");       // Stores the currently selected subject filter
  const [toast, setToast] = useState(null);      // Manages success/error popup notifications
  const navigate = useNavigate();

  // ==== Custom Delete Modal State ====
  // Manages the visibility and context of the custom confirmation modal
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    id: null,       // ID of the item to delete
    type: null,     // Determines the endpoint: 'test' or 'course'
    title: ""       // Displayed in the modal for confirmation
  });

  // Scroll to top on initial component mount
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // ==== Data Fetching Functions ====

  /**
   * Fetches tests created by the currently logged-in instructor.
   * The '?mine=1' query parameter instructs the backend to filter by req.userId.
   */
  const fetchTests = async () => {
    setLoading(true);
    try {
      const url = toAbsolute(`/api/tests?mine=1`);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTests(data || []);
    } catch (e) {
      setToast({ type: "error", msg: `Load failed: ${e.message}` });
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  /**
   * Fetches courses created by the currently logged-in instructor.
   */
  const fetchCourses = async () => {
    setLoading(true);
    try {
      const url = toAbsolute(`/api/courses?mine=1`);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCourses(Array.isArray(data) ? data : []);
    } catch (e) {
      setToast({ type: "error", msg: `Load failed: ${e.message}` });
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  // Re-fetch data whenever the user switches tabs
  useEffect(() => {
    if (tab === "tests") fetchTests();
    if (tab === "courses") fetchCourses();
    // eslint-disable-next-line
  }, [tab]);

  // ==== Search & Filter Logic (Memoized) ====

  /**
   * Memoized filtered list of tests.
   * Re-calculates only when 'tests', 'q' (search), or 'subj' (subject) changes.
   */
  const filteredTests = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tests.filter(t => {
      // Check subject match
      const okSubj = subj === "all" || t.subject === subj;
      if (!term) return okSubj;
      
      // Build a searchable string "haystack" from various metadata fields
      const hay = `${t.title} ${t.description || ""} ${(t.tags||[]).join(" ")} ${t.grade || ""}`.toLowerCase();
      
      // Return true if both subject matches and the search term is found in the haystack
      return okSubj && hay.includes(term);
    });
  }, [tests, q, subj]);

  /**
   * Memoized filtered list of courses.
   */
  const filteredCourses = useMemo(() => {
    const term = q.trim().toLowerCase();
    return courses.filter(c => {
      const okSubj = subj === "all" || c.subject === subj;
      if (!term) return okSubj;
      const hay = `${c.title} ${c.description || ""} ${(c.tags||[]).join(" ")} ${c.grade || ""}`.toLowerCase();
      return okSubj && hay.includes(term);
    });
  }, [courses, q, subj]);

  // ==== Action Handlers ====

  /**
   * Executes the deletion API call based on the data stored in the deleteModal state.
   * Triggered when the user clicks "Delete Permanently" inside the custom modal.
   */
  const executeDelete = async () => {
    const { id, type } = deleteModal;
    try {
      // Determine the correct API endpoint based on the item type
      const endpoint = type === 'test' ? `/api/tests/${id}` : `/api/courses/${id}`;
      
      const res = await fetch(toAbsolute(endpoint), {
        method: "DELETE",
        credentials: "include",
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message || `HTTP ${res.status}`);
      }

      setToast({ type: "success", msg: "Deleted permanently." });
      
      // Optimistically remove the item from the local state to avoid a full page reload
      if (type === 'test') {
        setTests(prev => prev.filter(x => String(x._id) !== String(id)));
      } else {
        setCourses(prev => prev.filter(x => String(x._id) !== String(id)));
      }
    } catch (e) {
      setToast({ type: "error", msg: `Delete failed: ${e.message}` });
    } finally {
      // Close the modal and reset its state regardless of success or failure
      setDeleteModal({ isOpen: false, id: null, type: null, title: "" });
      setTimeout(() => setToast(null), 4000);
    }
  };

  // ==== Render ====

  return (
    <div className="teacher-page">
      <SiteHeader />

      <main className="teacher-container">
        <div className="dash-top">
          <h1 className="pg-title">Instructor Dashboard</h1>

          {/* ---- Tab Navigation ---- */}
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

        {/* ---- Toolbar (Search, Filter, Add New) ---- */}
        {(tab === "tests" || tab === "courses") && (
          <div className="bar">
            <div className="bar-left">
              {/* Search Input */}
              <div className="search">
                <i className="bi bi-search" />
                <input
                  placeholder={tab === "tests" ? "Search your tests…" : "Search your courses…"}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              {/* Subject Filter Dropdown */}
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
              {/* Dynamic Add Button based on active tab */}
              {tab === "tests" ? (
                <button
                  className="primary-btn"
                  onClick={() => navigate("/instructor/tests/new")}
                >
                  <i className="bi bi-plus-lg" /> Add New Test
                </button>
              ) : (
                <button
                  className="primary-btn"
                  onClick={() => navigate("/instructor/courses/new")}
                >
                  <i className="bi bi-plus-lg" /> Add New Course
                </button>
              )}
            </div>
          </div>
        )}

        {/* ==== Tab: Tests List ==== */}
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
                      {/* Header with Title and Content Moderation Status Badge */}
                      <div className="tcard-header">
                        <h3 className="t-title">{t.title}</h3>
                        <span className={`status-badge ${t.visibility || 'pending'}`}>
                          {t.visibility || 'pending'}
                        </span>
                      </div>

                      {/* Display Admin Feedback if the test was rejected */}
                      {t.visibility === 'rejected' && t.adminFeedback && (
                        <div className="feedback-alert">
                          <strong>Admin Feedback:</strong> {t.adminFeedback}
                        </div>
                      )}

                      {t.description && (
                        <p className="t-desc" title={t.description}>{t.description}</p>
                      )}
                      
                      {/* Metadata Chips */}
                      <div className="t-meta">
                        <span className="chip">{(t.subject||"").toUpperCase()}</span>
                        {t.grade && <span className="chip">Grade {t.grade}</span>}
                        <span className="chip">{t.numQuestions} Qs</span>
                        {Array.isArray(t.tags) && t.tags.map((tg, i) => (
                          <span className="tag" key={i}>{tg}</span>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="tcard-actions">
                      <button
                        className="ghost-btn-edit"
                        onClick={() => navigate(`/instructor/tests/${t._id}/edit`)}
                      >
                        <i className="bi bi-pencil-square" /> Edit
                      </button>
                      <button
                        className="danger-btn"
                        // Triggers the custom modal instead of native window.confirm
                        onClick={() => setDeleteModal({ isOpen: true, id: t._id, type: 'test', title: t.title })}
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

        {/* ==== Tab: Courses List ==== */}
        {tab === "courses" && (
          <section className="list-wrap">
            {loading ? (
              <div className="empty">Loading…</div>
            ) : filteredCourses.length === 0 ? (
              <div className="empty">
                No courses found. Click <b>Add New Course</b> to create one.
              </div>
            ) : (
              <div className="cards">
                {filteredCourses.map(c => {
                  // Calculate total number of lessons across all sections
                  const sections = Array.isArray(c.sections) ? c.sections : [];
                  const lessons = sections.reduce((a, s) => a + (s.lessons?.length || 0), 0);
                  return (
                    <article key={c._id} className="tcard">
                      <div className="tcard-main">
                        {/* Header with Title and Content Moderation Status Badge */}
                        <div className="tcard-header">
                            <h3 className="t-title">{c.title}</h3>
                            <span className={`status-badge ${c.visibility || 'pending'}`}>
                            {c.visibility || 'pending'}
                            </span>
                        </div>

                        {/* Display Admin Feedback if the course was rejected */}
                        {c.visibility === 'rejected' && c.adminFeedback && (
                            <div className="feedback-alert">
                            <strong>Admin Feedback:</strong> {c.adminFeedback}
                            </div>
                        )}

                        {c.description && (
                          <p className="t-desc" title={c.description}>{c.description}</p>
                        )}
                        
                        {/* Metadata Chips */}
                        <div className="t-meta">
                          <span className="chip">{(c.subject||"").toUpperCase()}</span>
                          {c.grade && <span className="chip">Grade {c.grade}</span>}
                          <span className="chip">{lessons} lessons</span>
                          {Array.isArray(c.tags) && c.tags.map((tg, i) => (
                            <span className="tag" key={i}>{tg}</span>
                          ))}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="tcard-actions">
                        <button
                          className="ghost-btn-edit"
                          onClick={() => navigate(`/instructor/courses/${c._id}/edit`)}
                        >
                          <i className="bi bi-pencil-square" /> Edit
                        </button>
                        <button
                          className="danger-btn"
                          // Triggers the custom modal instead of native window.confirm
                          onClick={() => setDeleteModal({ isOpen: true, id: c._id, type: 'course', title: c.title })}
                        >
                          <i className="bi bi-trash-fill" /> Delete
                        </button>
                      </div>

                      <div className="tcard-foot">
                        <span className="muted">Updated {new Date(c.updatedAt).toLocaleString()}</span>
                        <span className="dot">•</span>
                        <span className="muted">Created {new Date(c.createdAt).toLocaleDateString()}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>

      {/* ==== Delete Confirmation Modal Overlay ==== */}
      {deleteModal.isOpen && (
        // Clicking the overlay background closes the modal
        <div className="modal-overlay" onClick={() => setDeleteModal({ isOpen: false, id: null, type: null, title: "" })}>
          {/* Prevent clicks inside the modal content area from closing the modal */}
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <h3>Confirm Deletion</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to permanently delete this {deleteModal.type}:</p>
              <p><strong>"{deleteModal.title}"</strong>?</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--error)', marginTop: '12px' }}>
                <i className="bi bi-info-circle-fill"></i> This action cannot be undone and will remove all associated data.
              </p>
            </div>
            <div className="modal-actions">
              <button 
                className="modal-btn-cancel" 
                onClick={() => setDeleteModal({ isOpen: false, id: null, type: null, title: "" })}
              >
                Cancel
              </button>
              <button 
                className="modal-btn-danger" 
                onClick={executeDelete}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global toast notification system */}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      <SiteFooter />
    </div>
  );
}