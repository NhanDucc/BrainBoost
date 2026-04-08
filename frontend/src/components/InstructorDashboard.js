import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { toAbsolute } from "../utils/url";
import "../css/InstructorDashboard.css";

// ==== Constants & Configurations ====

// Main navigation tabs for the dashboard
const TABS = [
  { key: "tests", label: "My Tests" },
  { key: "courses", label: "My Courses" },
];

// Predefined list of subjects for filtering
const SUBJECTS = [
  { key: "all", name: "All" },
  { key: "math", name: "Mathematics" },
  { key: "english", name: "English" },
  { key: "physics", name: "Physics" },
  { key: "chemistry", name: "Chemistry" },
];

// Options for dropdown filters
const GRADES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const DIFFS = ["Easy", "Medium", "Hard"];
const STATUSES = ["All", "Draft", "Pending", "Published", "Rejected", "Archived"];

/**
 * Extracts the difficulty level from an array of tags.
 * Falls back to "General" if no specific difficulty tag is found.
 */
const getDifficulty = (tags = []) => {
  const f = tags.find(t => DIFFS.includes(t));
  return f || "General";
};

// ==== Main Component ====

export default function InstructorDashboard() {
  const navigate = useNavigate();

  // ---- Navigation & Filter States ----
  const [tab, setTab] = useState("tests");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [subjectTab, setSubjectTab] = useState("all");
  const [filterGrade, setFilterGrade] = useState("All");
  const [filterDifficulty, setFilterDifficulty] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");

  // ---- Pagination & Data States ----
  const [page, setPage] = useState(1);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, totalItems: 0, limit: 12 });
  
  // ---- UI States ----
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  
  // Manages the state of the confirmation modal for Delete (Hard) and Archive (Soft) actions
  const [actionModal, setActionModal] = useState({ isOpen: false, id: null, type: null, title: "", action: "" });

  // ==== Lifecycle Effects ====

  // Automatically dismiss toast notifications after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Debounce the search input: Wait 500ms after the user stops typing before updating the actual query state
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQ(q), 500);
    return () => clearTimeout(handler);
  }, [q]);

  // Reset pagination to page 1 whenever any filter, tab, or search query changes
  useEffect(() => {
    setPage(1);
  }, [tab, debouncedQ, subjectTab, filterGrade, filterDifficulty, filterStatus]);

  // Main data fetching effect (Implements "Stale-While-Revalidate" caching pattern)
  useEffect(() => {
    let ignore = false;
    
    const fetchDashboardData = async () => {
      const isTest = tab === "tests";
      const endpoint = isTest ? "/api/tests" : "/api/courses";
        
      // Build the query string from active filters
      const params = new URLSearchParams();
      params.append("mine", "1");
      params.append("page", page);
      params.append("limit", 12);
        
      if (debouncedQ) params.append("q", debouncedQ);
      if (subjectTab !== "all") params.append("subject", subjectTab);
      if (filterGrade !== "All") params.append("grade", filterGrade);
      if (filterStatus !== "All") params.append("status", filterStatus);
      if (isTest && filterDifficulty !== "All") params.append("difficulty", filterDifficulty);

      const queryString = params.toString();
      // Create a unique cache key based on the current URL parameters
      const cacheKey = `dashboard_v3_${tab}_${queryString}`;

      // Check session storage for cached data to display instantly
      const cachedData = sessionStorage.getItem(cacheKey);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        setData(parsed.data || []);
        setPagination(parsed.pagination || { currentPage: page, totalPages: 1 });
        setLoading(false);  // Hide skeleton since we have cached data
      } else {
        setLoading(true);   // Show skeleton if no cache exists
      }

      // Fetch fresh data from the server in the background to ensure it is up-to-date
      try {
        const res = await fetch(toAbsolute(`${endpoint}?${queryString}`), { credentials: "include" });
        if (res.ok) {
          const json = await res.json();
          if (!ignore) {
            const fetchedData = json.data || (Array.isArray(json) ? json : []);
            const fetchedPagination = json.pagination || { currentPage: page, totalPages: 1 };
                    
            setData(fetchedData);
            setPagination(fetchedPagination);
            // Update the cache with the freshest data
            sessionStorage.setItem(cacheKey, JSON.stringify({ data: fetchedData, pagination: fetchedPagination }));
          }
        }
      } catch (e) {
        console.error("Fetch error:", e);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchDashboardData();
    return () => { ignore = true; };
  }, [tab, page, debouncedQ, subjectTab, filterGrade, filterDifficulty, filterStatus]);

  // ==== Action Handlers ====

  /**
   * Opens the confirmation modal before executing a destructive action.
   * Prevents accidental clicks from immediately deleting data.
   */
  const confirmAction = (e, id, type, title, action) => {
    e.stopPropagation();
    setActionModal({ isOpen: true, id, type, title, action });
  };

  /**
   * Executes either a Hard Delete or an Archive (Soft Delete) based on the modal's state.
   */
  const executeAction = async () => {
    const { id, type, action } = actionModal;
    try {
      // Determine the correct API endpoint and HTTP method
      const endpoint = type === "test" 
        ? `/tests/${id}${action === 'archive' ? '/archive' : ''}` 
        : `/courses/${id}${action === 'archive' ? '/archive' : ''}`;
      
      // Automatically handle CSRF tokens
      if (action === 'archive') {
         await api.patch(endpoint);   // Archive is an update
      } else {
         await api.delete(endpoint);  // Permanent deletion
      }
      
      // Clear relevant session storage cache to force a fresh fetch on next load
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith(`dashboard_v3_${tab}`)) sessionStorage.removeItem(key);
      });
      
      if (action === 'delete') {
        // Optimistically remove the item from the UI
        setData(prev => prev.filter(item => item._id !== id));
      } else {
        // Reload the page to reflect the new "Archived" status correctly
        window.location.reload();
      }
      
      setToast({ type: "success", msg: `${type === "test" ? "Test" : "Course"} ${action}d.` });
    } catch (e) {
      // Extract error message safely
      const errorMsg = e.response?.data?.message || e.message;
      setToast({ type: "error", msg: `Action failed: ${errorMsg}` });
    } finally {
      // Close the modal
      setActionModal({ isOpen: false, id: null, type: null, title: "", action: "" });
    }
  };

  const fmtDate = (d) => new Date(d).toLocaleDateString();
  const formatType = tab === "tests" ? "Test" : "Course";

  /**
   * Skeleton placeholder component shown while data is loading.
   * Helps prevent Cumulative Layout Shift (CLS) by maintaining the grid structure.
   */
  const SkeletonCard = () => (
    <div className="t-card grid-item skeleton-card">
      <div className="t-card-thumb skeleton skeleton-img"></div>

      <div className="t-card-body">
        <div className="skeleton skeleton-title"></div>
        <div className="skeleton skeleton-title" style={{ width: '60%' }}></div>
        <div className="status-row"><div className="skeleton skeleton-badge-large"></div></div>
        <div className="t-meta"><div className="skeleton skeleton-badge-small"></div><div className="skeleton skeleton-badge-small"></div></div>
      </div>

      <div className="t-card-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div className="skeleton skeleton-btn"></div><div className="skeleton skeleton-btn"></div><div className="skeleton skeleton-btn" style={{ width: '20%' }}></div>
      </div>
    </div>
  );

  // ==== Render UI ====

  return (
    <div className="teacher-page">
      <SiteHeader />
      <div className="teacher-container">
        
        {/* ==== Dashboard Header & Tabs ==== */}
        <div className="dash-top">
          <div>
            <h1 className="pg-title">Instructor Dashboard</h1>
            <div className="tabs-row">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  className={`tab ${tab === t.key ? "active" : ""}`}
                  onClick={() => {
                      setTab(t.key);
                      // Reset all dropdown filters when switching main tabs
                      setFilterGrade("All");
                      setFilterDifficulty("All");
                      setFilterStatus("All");
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <button className="primary-btn" onClick={() => navigate(tab === "tests" ? "/instructor/tests/new" : "/instructor/courses/new")}>
            + New {formatType}
          </button>
        </div>

        {/* ==== Toolbar: Search & Filters ==== */}
        <div className="teacher-toolbar">
          <div className="toolbar-top-row">
            {/* Search Bar */}
            <div className="search">
              <i className="bi bi-search"></i>
              <input placeholder={`Search ${tab}...`} value={q} onChange={(e) => setQ(e.target.value)} />
              {q && <button className="clear-btn" onClick={() => setQ("")}>✕</button>}
            </div>
                
            {/* Filter Dropdowns */}
            <div className="filter-group">
              <div className="filter-item">
                <i className="bi bi-funnel-fill"></i>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="All">All Status</option>
                  {STATUSES.filter(s => s !== "All").map(s => ( <option key={s} value={s}>{s}</option> ))}
                </select>
              </div>

              <div className="filter-item">
                <i className="bi bi-mortarboard-fill"></i>
                <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)}>
                  <option value="All">All Grades</option>
                  {GRADES.map(g => ( <option key={g} value={g}>Grade {g}</option> ))}
                </select>
              </div>

              {/* Difficulty filter only makes sense for tests, hide it for courses */}
              {tab === "tests" && (
                <div className="filter-item">
                  <i className="bi bi-bar-chart-steps"></i>
                    <select value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}>
                      <option value="All">All Difficulties</option>
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                </div>
              )}
            </div>
          </div>

          {/* Subject Filter Tabs */}
          <div className="subj-tabs">
            {SUBJECTS.map((s) => (
              <button key={s.key} className={`subj-tab ${subjectTab === s.key ? "active" : ""}`} onClick={() => setSubjectTab(s.key)}>{s.name}</button>
            ))}
          </div>
        </div>

        {/* Data Grid & Cards */}
        {loading && data.length === 0 ? (
          <div className="t-grid">{[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : data.length === 0 ? (
          <div className="empty">No {tab} found. Try adjusting your search or filters.</div>
        ) : (
          <>
            <div className="t-grid">
              {data.map((item) => (
                <div 
                  key={item._id} 
                  className={`t-card grid-item ${item.visibility === 'rejected' ? 'status-rejected' : ''} ${item.visibility === 'archived' ? 'status-archived' : ''}`} 
                  onClick={() => navigate(tab === "tests" ? `/instructor/tests/${item._id}/edit` : `/instructor/courses/${item._id}/edit`)}
                >
                  {/* Card Thumbnail / Icon Header */}
                  <div className={`t-card-thumb thumb-${(item.subject || "").toLowerCase()}`}>
                    {tab === "courses" && item.coverUrl ? ( <img src={item.coverUrl} alt="" className="grid-thumb-img" /> ) : ( <i className={tab === "tests" ? "bi bi-trophy" : "bi bi-journal-album"}></i> )}
                  </div>

                  {/* Card Body Information */}
                  <div className="t-card-body">
                    <h3 className="t-title">{item.title}</h3>
                    
                    {/* Moderation Status Badges */}
                    <div className="status-row">
                      {item.visibility === "draft" && <span className="status-badge draft"><i className="bi bi-pencil-fill"></i> Draft</span>}
                      {item.visibility === "pending" && <span className="status-badge pending"><i className="bi bi-hourglass-split"></i> Pending Review</span>}
                      {item.visibility === "rejected" && <span className="status-badge rejected"><i className="bi bi-x-circle-fill"></i> Rejected</span>}
                      {item.visibility === "published" && <span className="status-badge published"><i className="bi bi-check-circle-fill"></i> Published</span>}
                      {item.visibility === "archived" && <span className="status-badge archived"><i className="bi bi-archive-fill"></i> Archived</span>}
                    </div>

                    {/* Metadata Chips (Subject, Grade, Difficulty) */}
                    <div className="t-meta">
                      <span className={`chip chip-${item.subject}`}>{item.subject}</span>
                      {item.grade && <span className="chip grade">Grade {item.grade}</span>}
                      {tab === "tests" && <span className="chip diff">{getDifficulty(item.tags)}</span>}
                    </div>

                    {/* Inline Admin Feedback (Only shown if rejected) */}
                    {item.adminFeedback && item.visibility === 'rejected' && (
                      <div style={{ fontSize: '12px', color: '#b91c1c', background: '#fee2e2', padding: '8px', borderRadius: '6px', marginBottom: '12px' }}>
                        <strong>Feedback:</strong> {item.adminFeedback}
                      </div>
                    )}

                    {/* Bottom Stats Row (Dates, Questions/Sections count) */}
                    <div className="t-stats-row">
                      <span className="meta-item"><i className="bi bi-calendar-event"></i> {fmtDate(item.updatedAt)}</span>
                      {tab === "tests" ? ( <span className="meta-item"><i className="bi bi-list-task"></i> {item.numQuestions || (item.questions?.length || 0)} Qs</span> ) : ( <span className="meta-item"><i className="bi bi-journal-album"></i> {item.sections?.length || 0} Secs</span> )}
                    </div>

                    {/* Highlighted Student Attempts (Only for Tests) */}
                    {tab === "tests" && item.attempts > 0 && (
                      <div className="attempts-row attempts-highlight"><i className="bi bi-lightning-charge-fill"></i> {item.attempts} attempts</div>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="t-card-footer">
                    <div className="t-actions">
                      {tab === "tests" && (
                        <button className="act-btn result" onClick={(e) => { e.stopPropagation(); navigate(`/tests/public/${item._id}/leaderboard`); }} title="View Results">
                          <i className="bi bi-trophy"></i> Results
                        </button>
                      )}
                      
                      <button className="act-btn edit" title="Edit/View">
                        <i className="bi bi-pencil-square"></i> Edit
                      </button>

                      {/* Safely handle deletion: Live items get Archived, drafts/rejected get Hard Deleted */}
                      {item.visibility === "published" ? (
                        <button className="act-btn archive" title="Archive" onClick={(e) => confirmAction(e, item._id, tab === "tests" ? "test" : "course", item.title, "archive")}>
                          <i className="bi bi-archive"></i> Archive
                        </button>
                      ) : (
                        <button className="act-btn del" title="Delete" onClick={(e) => confirmAction(e, item._id, tab === "tests" ? "test" : "course", item.title, "delete")}>
                          <i className="bi bi-trash"></i> Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* ==== Pagination Controls ==== */}
            {pagination.totalPages > 1 && (
              <div className="t-pagination">
                <button className="page-btn" disabled={pagination.currentPage === 1} onClick={() => setPage(p => p - 1)}>
                  <i className="bi bi-chevron-left"></i> Prev
                </button>

                {/* Generate numbered page buttons dynamically */}
                {[...Array(pagination.totalPages)].map((_, i) => (
                  <button key={i + 1} className={`page-btn ${pagination.currentPage === i + 1 ? 'active' : ''}`} onClick={() => setPage(i + 1)}>{i + 1}</button>
                ))}

                <button className="page-btn" disabled={pagination.currentPage === pagination.totalPages} onClick={() => setPage(p => p + 1)}>
                  Next <i className="bi bi-chevron-right"></i>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ==== Action Confirmation Modal ==== */}
      {actionModal.isOpen && (
        <div className="modal-overlay" onClick={() => setActionModal({ isOpen: false, id: null, type: null, title: "", action: "" })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              {/* Change icon and color based on whether it's a delete or archive action */}
              <i className={actionModal.action === 'archive' ? "bi bi-archive-fill" : "bi bi-exclamation-triangle-fill"} style={{color: actionModal.action === 'archive' ? '#eab308' : 'var(--error)'}}></i>
              <h3>Confirm {actionModal.action === 'archive' ? 'Archiving' : 'Deletion'}</h3>
            </div>

            <div className="modal-body">
              <p>Are you sure you want to {actionModal.action} this {actionModal.type}:</p>
              <p><strong>"{actionModal.title}"</strong>?</p>

              {/* Show context-specific warnings to the user */}
              {actionModal.action === 'delete' ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--error)', marginTop: '12px' }}><i className="bi bi-info-circle-fill"></i> This action cannot be undone.</p>
              ) : (
                <p style={{ fontSize: '0.85rem', color: '#ca8a04', marginTop: '12px' }}><i className="bi bi-info-circle-fill"></i> This will hide it from students, but preserve existing points and progress.</p>
              )}
            </div>

            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setActionModal({ isOpen: false, id: null, type: null, title: "", action: "" })}>Cancel</button>
              <button className={actionModal.action === 'archive' ? "modal-btn-warning" : "modal-btn-danger"} onClick={executeAction}>
                {actionModal.action === 'archive' ? 'Archive Now' : 'Delete Permanently'}
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