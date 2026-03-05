import "../css/Footer.css";

/**
 * SiteFooter Component
 * Renders the global footer displayed at the bottom of the application.
 * Contains brand information, contact details, navigation links, and legal documents.
 */
const SiteFooter = () => {
  return (
    <footer className="site-footer">
      {/* ==== Main Footer Content ==== */}
      <div className="footer-grid">

        {/* Brand & Contact Information Column */}
        <section className="footer-brand">
          <h3 className="f-title">BrainBoost</h3>
          <p className="f-desc">
            BrainBoost is an online learning platform for students from elementary to high school,
            helping them excel in subjects like Math, English, Physics, and Chemistry with the support of advanced artificial intelligence.
          </p>

          <ul className="f-contact">
            {/* Location */}
            <li>
              <span className="f-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" stroke="#1A1A1A" strokeWidth="1.6"/>
                  <circle cx="12" cy="10" r="2.8" stroke="#1A1A1A" strokeWidth="1.6"/>
                </svg>
              </span>
              <span>Da Nang City</span>
            </li>
            {/* Email Contact */}
            <li>
              <span className="f-icon" aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18v12H3z" stroke="#1A1A1A" strokeWidth="1.6"/>
                  <path d="M3 7l9 6 9-6" stroke="#1A1A1A" strokeWidth="1.6"/>
                </svg>
              </span>
              <a href="mailto:brainboost.work@gmail.com">brainboost.work@gmail.com</a>
            </li>
          </ul>
        </section>

        {/* About Navigation Column */}
        <nav className="footer-col" aria-label="About BrainBoost">
          <h4 className="f-title">About BrainBoost</h4>
          <ul>
            <li><a href="/about">About Us</a></li>
            <li><a href="/terms-of-use">Terms of Service</a></li>
            <li><a href="/privacy-policy">Privacy Policy</a></li>
            <li><a href="/payment">Payment Instructions</a></li>
          </ul>
        </nav>

        {/* Platform Information & Resources Column */}
        <nav className="footer-col" aria-label="BrainBoost Information">
          <h4 className="f-title">BrainBoost Information</h4>
          <ul>
            <li><a href="/apply-instructor">Register as a Lecturer</a></li>
            <li><a href="/courses">Course List</a></li>
            <li><a href="/faq">FAQ</a></li>
            <li><a href="/blog">Sharing Corner</a></li>
          </ul>
        </nav>
      </div>

      {/* ==== Footer Bottom (Copyright & Legal Links) ==== */}
      <div className="footer-bottom centered two-rows">
        {/* Dynamically generates the current year for the copyright notice */}
        <p className="legal">© {new Date().getFullYear()} BrainBoost. All rights reserved.</p>

        <div className="footer-links">
            <a href="/privacy-policy">Privacy</a>
            <span className="sep">•</span>
            <a href="/terms-of-use">Terms</a>
            <span className="sep">•</span>
            <a href="/cookies">Cookies</a>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;