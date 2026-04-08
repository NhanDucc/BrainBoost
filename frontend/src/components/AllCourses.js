import { useEffect, useMemo, useState } from "react";
import "../css/AllCourses.css";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toAbsolute } from "../utils/url";

// ==== Constants & Configurations ====

// Predefined list of subjects used for categorization and filtering
const SUBJECTS = [
  { key: "math", name: "Mathematics" },
  { key: "english", name: "English" },
  { key: "physics", name: "Physics" },
  { key: "chemistry", name: "Chemistry" },
];

// Navigation tabs including an "All" option to view every subject
const TABS = [{ key: "all", name: "All" }, ...SUBJECTS];

export default function AllCourses() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // ---- Navigation & Filter States ----
  
  // Extract initial subject from URL query parameters (e.g., ?subject=math)
  const urlSubject = searchParams.get("subject");
  const initialTab = SUBJECTS.find(s => s.key === urlSubject) ? urlSubject : "all";

  const [tab, setTab] = useState(initialTab);          // Currently selected subject tab
  const [query, setQuery] = useState("");              // Current text search query
  const [filterGrade, setFilterGrade] = useState("All"); // Currently selected grade level filter

  // ---- Data & UI States ----
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [courses, setCourses] = useState([]);         // Original list of courses fetched from API

  // ==== API Fetching Logic ====

  /**
   * Fetches the public course list from the backend whenever the subject tab
   * or the search query changes. Includes a cleanup mechanism to avoid race conditions.
   */
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        setErr("");

        // Build the query string for the API request
        const qs = new URLSearchParams();
        if (tab && tab !== "all") qs.set("subject", tab);
        if (query.trim()) qs.set("q", query.trim());

        const url = toAbsolute(
          `/api/courses/public${qs.toString() ? `?${qs}` : ""}`
        );

        const res = await fetch(url);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        if (!ignore) setCourses(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!ignore) setErr(e.message || "Failed to load");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [tab, query]);

  // ==== Data Processing (Memoized) ====

  /**
   * Automatically generates a unique list of available Grade levels from the fetched data.
   * Includes numeric sorting logic to ensure 'Grade 2' appears before 'Grade 10'.
   */
  const AVAILABLE_GRADES = useMemo(() => {
    // Extract unique grades and remove null/empty values
    const grades = new Set(courses.map(c => c.grade).filter(Boolean));

    const sortedGrades = Array.from(grades).sort((a, b) => {
      const strA = String(a);
      const strB = String(b);
      // Extract numbers using regex for accurate numeric sorting
      const numA = parseInt(strA.replace(/\D/g, ''));
      const numB = parseInt(strB.replace(/\D/g, ''));

      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return strA.localeCompare(strB);
    });

    return ["All", ...sortedGrades];
  }, [courses]);

  /**
   * Filters the course list locally based on the selected Grade level.
   * This provides instant feedback without needing a new network request.
   */
  const filtered = useMemo(() => {
    if (filterGrade === "All") return courses;
    
    return courses.filter(c => {
      // Compare trimmed lowercase strings to ensure accuracy
      const courseGrade = String(c.grade || "").trim().toLowerCase();
      const selectedGrade = String(filterGrade).trim().toLowerCase();
      return courseGrade === selectedGrade;
    });
  }, [courses, filterGrade]);

  /**
   * Groups the filtered courses by subject. 
   * This is used to render distinct sections (e.g., Mathematics, English) when the "All" tab is active.
   */ 
  const grouped = useMemo(() => {
    const map = new Map();
    // Pre-initialize map with empty arrays for each defined subject
    SUBJECTS.forEach((s) => map.set(s.key, []));
    
    // Distribute courses into their respective subject groups
    filtered.forEach((c) => {
      if (!map.has(c.subject)) map.set(c.subject, []);
      map.get(c.subject).push(c);
    });
    
    return map;
  }, [filtered]);

  // Scroll to the top of the page when the component first mounts
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // ==== UI Components ====

  /**
   * Renders an individual Course Card with metadata and navigation.
   * @param {Object} c - The course data object.
   */
  const renderCard = (c) => (
    <article
      key={c.id}
      className="course-card"
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/courses/${c.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") navigate(`/courses/${c.id}`);
      }}
    >
      <div className="thumb">
        <img src={c.coverUrl || "/img/course-placeholder.jpg"} alt="" />
      </div>

      <div className="info">
        <div className="course-topline">
          <span className={`chip-mini chip-${(c.subject || "").toLowerCase()}`}>
              {SUBJECTS.find(s => s.key === c.subject)?.name || c.subject}
          </span>
          {c.grade && <span className="chip-mini chip-grade">Grade {c.grade}</span>}
        </div>

        <h3 className="title">{c.title}</h3>
        <p className="subtitle" title={c.description}>{c.description || "No description available."}</p>
        
        <div className="meta">
          <span className="meta-item" data-ico="📘">{c.lessons} lessons</span>
          <span className="meta-dot">•</span>
          <span className="meta-item" data-ico="⏱️">{c.hours || 0} hours</span>
        </div>
      </div>

      <div className="price-row">
        <span className="price">{!c.priceUSD || c.priceUSD === 0 ? "Free" : `$${c.priceUSD}`}</span>
        <button
          className="ghost-btn"
          onClick={(e) => { e.stopPropagation(); navigate(`/courses/${c.id}`); }}
        >
          Details
        </button>
      </div>
    </article>
  );

  return (
    <div className="courses-page">
      <SiteHeader />

      {/* ==== Search & Filter Toolbar ==== */}
      <div className="courses-toolbar">
        <div className="toolbar-top-row">
          {/* Main Search Input */}
          <div className="searchbox">
            <span className="bi bi-search"></span>
            <input
              type="text"
              placeholder="Search courses, topics, or grade…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="clear-btn" aria-label="Clear" onClick={() => setQuery("")}>×</button>
            )}
          </div>

          {/* Grade Level Filter Dropdown */}
          <div className="filter-group">
            <div className="filter-item">
              <i className="bi bi-mortarboard-fill"></i>
                <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)}>
                  <option value="All">All Grades</option>
                  {/* Only show numeric grades found in the current dataset */}
                  {AVAILABLE_GRADES.filter(g => g !== "All").map(g => (
                    <option key={g} value={g}>Grade {g}</option>
                  ))}
                </select>
            </div>
          </div>
        </div>

        {/* Subject Navigation Tabs */}
        <div className="courses-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`tab ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* ==== Data Grid Display ==== */}
      {loading && <div className="empty">Loading…</div>}
      {!loading && err && <div className="empty">Error: {err}</div>}

      {!loading && !err && (
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 16px' }}>
          {/* Logic for "All" Tab: Display sections for each subject */}
          {tab === "all" ? (
            SUBJECTS.map((s) => {
              const list = grouped.get(s.key) || [];
              if (!list.length) return null;
              return (
                <section key={s.key} className="courses-section">
                  <h2 className="section-title-subject">{s.name}</h2>
                  <div className="courses-grid">
                    {list.map(c => renderCard(c))}
                  </div>
                </section>
              );
            })
          ) : (
            /* Logic for Individual Subject Tab */
            <section className="courses-section">
              <h2 className="section-title-subject">{SUBJECTS.find(s => s.key === tab)?.name}</h2>
              <div className="courses-grid">
                {filtered.map(c => renderCard(c))}
              </div>
              {!filtered.length && <div className="empty" style={{ textAlign: 'center', padding: '40px' }}>No courses found.</div>}
            </section>
          )}
        </div>
      )}

      <SiteFooter />
    </div>
  );
}