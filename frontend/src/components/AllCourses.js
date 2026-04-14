import { useEffect, useMemo, useState } from "react";
import "../css/AllCourses.css";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toAbsolute } from "../utils/url";
import ContentCover from '../components/ContentCover';

// ==== Constants & Configurations ====

// Predefined list of subjects used for categorization and rendering sections
const SUBJECTS = [
  { key: "math", name: "Mathematics" },
  { key: "english", name: "English" },
  { key: "physics", name: "Physics" },
  { key: "chemistry", name: "Chemistry" },
];

// Navigation tabs including an "All" option to view every subject grouped together
const TABS = [{ key: "all", name: "All" }, ...SUBJECTS];

export default function AllCourses() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // ---- Navigation & Filter States ----
  
  // Extract initial subject from URL query parameters (e.g., ?subject=math)
  const urlSubject = searchParams.get("subject");
  const initialTab = SUBJECTS.find(s => s.key === urlSubject) ? urlSubject : "all";

  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [filterGrade, setFilterGrade] = useState("All");

  // ---- Data & UI States ----
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [courses, setCourses] = useState([]);

  // ==== Side Effects & Data Fetching ====

  /**
   * Debounce Effect: Prevents API spam when the user is typing.
   * Waits 500ms after the last keystroke before updating `debouncedQuery`.
   */
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(handler);
  }, [query]);

  /**
   * Data Fetching Effect (Stale-While-Revalidate Caching Pattern)
   * 1. Checks sessionStorage for cached data and displays it instantly (0s loading).
   * 2. Fetches fresh data from the server in the background.
   * 3. Silently updates the state and cache with the new data.
   */
  useEffect(() => {
    let ignore = false; // Flag to prevent state updates if the component unmounts
    
    (async () => {
      try {
        // Build the query string for the API request based on active filters
        const qs = new URLSearchParams();
        if (tab && tab !== "all") qs.set("subject", tab);
        if (debouncedQuery.trim()) qs.set("q", debouncedQuery.trim());

        const queryString = qs.toString();
        // Generate a unique cache key based on the current URL parameters
        const cacheKey = `public_courses_v1_${tab}_${queryString}`;
        
        // Check cache for immediate display
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            setCourses(JSON.parse(cached));
            setLoading(false); // Hide skeletons if cache exists
        } else {
            setLoading(true);  // Show skeletons if no cache exists
        }
        setErr("");

        const url = toAbsolute(`/api/courses/public${queryString ? `?${queryString}` : ""}`);
        const res = await fetch(url);
        
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.message || `HTTP ${res.status}`);
        }
        
        // Fetch fresh data from server, update state, and overwrite the cache
        const data = await res.json();
        if (!ignore) {
            const fetchedCourses = Array.isArray(data) ? data : [];
            setCourses(fetchedCourses);
            sessionStorage.setItem(cacheKey, JSON.stringify(fetchedCourses));
            setLoading(false);
        }
      } catch (e) {
        if (!ignore) {
            setErr(e.message || "Failed to load");
            setLoading(false);
        }
      }
    })();
    
    // Cleanup function
    return () => { ignore = true; };
  }, [tab, debouncedQuery]);

  // Scroll to the top of the page when the component first mounts
  useEffect(() => { window.scrollTo(0, 0); }, []);

  // ==== Data Processing (Memoized for Performance) ====

  /**
   * Dynamically generates a unique list of available Grade levels from the fetched data.
   * Includes numeric sorting logic (e.g., ensuring 'Grade 2' appears before 'Grade 10').
   */
  const AVAILABLE_GRADES = useMemo(() => {
    const grades = new Set(courses.map(c => c.grade).filter(Boolean));
    const sortedGrades = Array.from(grades).sort((a, b) => {
        const strA = String(a);
        const strB = String(b);
        // Extract numbers using regex for accurate numeric sorting
        const numA = parseInt(strA.replace(/\D/g, ''));
        const numB = parseInt(strB.replace(/\D/g, ''));
        
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return strA.localeCompare(strB); // Fallback to alphabetical sorting
    });
    return ["All", ...sortedGrades];
  }, [courses]);

  /**
   * Filters the course list locally based on the selected Grade dropdown.
   */
  const filtered = useMemo(() => {
    if (filterGrade === "All") return courses;
    return courses.filter(c => String(c.grade || "").trim().toLowerCase() === String(filterGrade).trim().toLowerCase());
  }, [courses, filterGrade]);

  /**
   * Groups the filtered courses by subject. 
   * Used to render distinct sections (Mathematics, English, etc.) when the "All" tab is active.
   */
  const grouped = useMemo(() => {
    const map = new Map();
    SUBJECTS.forEach((s) => map.set(s.key, [])); // Initialize empty arrays for all subjects
    
    filtered.forEach((c) => {
      if (!map.has(c.subject)) map.set(c.subject, []);
      map.get(c.subject).push(c);
    });
    return map;
  }, [filtered]);

  // ==== UI Components ====

  /**
   * Skeleton UI for loading state to prevent Cumulative Layout Shift (CLS).
   * Mimics the exact dimensions of a real course card.
   */
  const SkeletonCard = () => (
    <article className="course-card skeleton-card">
        <div className="thumb skeleton skeleton-img"></div>
        <div className="info">
            <div className="course-topline">
                <div className="skeleton skeleton-badge-small"></div>
                <div className="skeleton skeleton-badge-small"></div>
            </div>
            <div className="skeleton skeleton-title" style={{ height: '24px', marginBottom: '8px' }}></div>
            <div className="skeleton skeleton-title" style={{ height: '14px', width: '80%' }}></div>
            <div className="meta" style={{ marginTop: '12px' }}>
                <div className="skeleton skeleton-badge-small"></div>
            </div>
        </div>
        <div className="price-row">
            <div className="skeleton skeleton-badge-small" style={{ width: '40px' }}></div>
            <div className="skeleton skeleton-btn"></div>
        </div>
    </article>
  );

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
    >
      <div className="thumb">
        <ContentCover 
          coverUrl={c.coverUrl} 
          title={c.title} 
          subject={c.subject} 
          grade={c.grade} 
        />
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
        <button className="ghost-btn" onClick={(e) => { e.stopPropagation(); navigate(`/courses/${c.id}`); }}>
          Details
        </button>
      </div>
    </article>
  );

  // ==== Main Render ====

  return (
    <div className="courses-page">
      <SiteHeader />

      {/* ==== Search & Filter Toolbar ==== */}
      <div className="courses-toolbar">
        <div className="toolbar-top-row">
          
          {/* Main Search Input */}
          <div className="searchbox">
            <span className="bi bi-search"></span>
            <input type="text" placeholder="Search courses, topics, or grade…" value={query} onChange={(e) => setQuery(e.target.value)} />
            {query && <button className="clear-btn" aria-label="Clear" onClick={() => setQuery("")}>×</button>}
          </div>
          
          {/* Grade Level Filter Dropdown */}
          <div className="filter-group">
            <div className="filter-item">
              <i className="bi bi-mortarboard-fill"></i>
                <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)}>
                  <option value="All">All Grades</option>
                  {/* Only display grades that exist in the current dataset */}
                  {AVAILABLE_GRADES.filter(g => g !== "All").map(g => (<option key={g} value={g}>Grade {g}</option>))}
                </select>
            </div>
          </div>
        </div>
        
        {/* Subject Navigation Tabs */}
        <div className="courses-tabs">
          {TABS.map((t) => (
            <button key={t.key} className={`tab ${tab === t.key ? "active" : ""}`} onClick={() => setTab(t.key)}>{t.name}</button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {!loading && err && <div className="empty">Error: {err}</div>}

      {/* ==== Data Grid Display ==== */}
      {/* Show Skeletons ONLY if loading is true AND there is no cached data available yet */}
      {loading && courses.length === 0 ? (
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 16px' }}>
            <section className="courses-section">
              <h2 className="section-title-subject skeleton skeleton-title" style={{ width: '150px' }}></h2>
              <div className="courses-grid">{[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}</div>
            </section>
        </div>
      ) : (!err && (
        <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '0 16px' }}>
          
          {/* Logic for "All" Tab: Display categorized sections for each subject */}
          {tab === "all" ? (
            SUBJECTS.map((s) => {
              const list = grouped.get(s.key) || [];
              if (!list.length) return null; // Hide sections with no courses
              return (
                <section key={s.key} className="courses-section">
                  <h2 className="section-title-subject">{s.name}</h2>
                  <div className="courses-grid">{list.map(c => renderCard(c))}</div>
                </section>
              );
            })
          ) : (
            
            /* Logic for Individual Subject Tab: Display a continuous grid of courses */
            <section className="courses-section">
                <h2 className="section-title-subject">{SUBJECTS.find(s => s.key === tab)?.name}</h2>
                <div className="courses-grid">{filtered.map(c => renderCard(c))}</div>
                
                {/* Empty state if filters yield no results */}
                {!filtered.length && <div className="empty" style={{ textAlign: 'center', padding: '40px' }}>No courses found.</div>}
            </section>
          )}
        </div>
      ))}
      <SiteFooter />
    </div>
  );
}