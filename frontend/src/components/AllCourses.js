import React, { use, useMemo, useState } from "react";
import "../css/AllCourses.css";
import { COURSES, SUBJECTS, pickThumb } from "../data/courses";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const TABS = [{ key: "all", name: "All" }, ...SUBJECTS];

const matchesQuery = (course, q) => {
  if (!q) return true;
  const hay = (
    course.title +
    " " +
    (course.subtitle || "") +
    " " +
    (course.tags || []).join(" ")
  ).toLowerCase();
  return hay.includes(q.toLowerCase());
};

export default function AllCourses() {
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  // Filter by tab and search
  const filtered = useMemo(() => {
    return COURSES.filter(
      (c) => (tab === "all" || c.subject === tab) && matchesQuery(c, query)
    );
  }, [tab, query]);

  const grouped = useMemo(() => {
    const map = new Map();
    SUBJECTS.forEach((s) => map.set(s.key, []));
    filtered.forEach((c) => {
      if (!map.has(c.subject)) map.set(c.subject, []);
      map.get(c.subject).push(c);
    });
    return map;
  }, [filtered]);


  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="courses-page">
      {/* Header */}
      <SiteHeader />

      {/* Tool bar */}
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

      {/* Sections per subject */}
      {SUBJECTS.map((s) => {
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
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === " ") navigate(`/courses/${c.id}`); }}>
                  
                  <div className="thumb">
                    <img src={pickThumb(c.thumbKey)} alt="" />
                  </div>

                  <div className="info">
                    <h3 className="title">{c.title}</h3>
                    {c.subtitle && <p className="subtitle" title={c.subtitle}>{c.subtitle}</p>}
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
                      onClick={(e) => { 
                        e.stopPropagation();
                        navigate(`/courses/${c.id}`); }}>Details</button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      })}
        {/* Footer */}
        <SiteFooter />
    </div>
  );
}
