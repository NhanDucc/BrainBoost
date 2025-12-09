import React, { useEffect, useMemo, useState } from "react";
import "../css/AllCourses.css";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { useNavigate } from "react-router-dom";
import { toAbsolute } from "../utils/url";

const SUBJECTS = [
  { key: "math", name: "Mathematics" },
  { key: "english", name: "English" },
  { key: "physics", name: "Physics" },
  { key: "chemistry", name: "Chemistry" },
];

const TABS = [{ key: "all", name: "All" }, ...SUBJECTS];

export default function AllCourses() {
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [courses, setCourses] = useState([]);
  const navigate = useNavigate();

  // fetch từ backend mỗi khi tab/query đổi
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const qs = new URLSearchParams();
        if (tab && tab !== "all") qs.set("subject", tab);
        if (query.trim()) qs.set("q", query.trim());

        const url = toAbsolute(
          `/api/courses/public${qs.toString() ? `?${qs}` : ""}`
        );

        const res = await fetch(url); // KHÔNG cần credentials ở đây
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

  // group theo subject để render section giống bản cũ
  const grouped = useMemo(() => {
    const map = new Map();
    SUBJECTS.forEach((s) => map.set(s.key, []));
    courses.forEach((c) => {
      if (!map.has(c.subject)) map.set(c.subject, []);
      map.get(c.subject).push(c);
    });
    return map;
  }, [courses]);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="courses-page">
      <SiteHeader />

      <div className="courses-toolbar">
        <div className="courses-search">
          <i className="bi bi-search"></i>
          <input
            type="text"
            placeholder="Search courses, topics, or grade…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="courses-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`chip ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className="empty">Loading…</div>}
      {!loading && err && <div className="empty">Error: {err}</div>}

      {!loading && !err && SUBJECTS.map((s) => {
        const list = grouped.get(s.key) || [];
        if (!list.length) return null;
        return (
          <section key={s.key} className="courses-section">
            <h2 className="section-title-subject">{s.name}</h2>

            <div className="courses-grid">
              {list.map((c) => (
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
                    <h3 className="title">{c.title}</h3>
                    <div className="meta">
                      <span className="meta-item" data-ico="📘">{c.lessons} lessons</span>
                      <span className="meta-dot">•</span>
                      <span className="meta-item" data-ico="⏱️">{c.hours} hours</span>
                    </div>
                  </div>

                  <div className="price-row">
                    <span className="price">${c.priceUSD}</span>
                    <button
                      className="ghost-btn"
                      onClick={(e) => { e.stopPropagation(); navigate(`/courses/${c.id}`); }}
                    >
                      Details
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      <SiteFooter />
    </div>
  );
}
