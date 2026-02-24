import React from "react";
import SiteHeader from "../components/Header";
import SiteFooter from "../components/Footer";
import "./legal.css";

export default function Privacy() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      <SiteHeader />
      
      <main className="legal-page" style={{ flex: 1 }}>
        <header className="legal-header">
          <h1>Privacy Policy</h1>
          <p className="updated">Last updated: 2025-09-03</p>
        </header>

        <nav className="legal-toc" aria-label="Table of contents">
          <strong>On this page</strong>
          <ul>
            <li><a href="#information-we-collect">Information we collect</a></li>
            <li><a href="#how-we-use">How we use your information</a></li>
            <li><a href="#cookies">Cookies & tracking</a></li>
            <li><a href="#retention">Data retention</a></li>
            <li><a href="#rights">Your rights</a></li>
            <li><a href="#children">Children’s privacy</a></li>
            <li><a href="#security">Security</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
        </nav>

        <section id="information-we-collect" className="legal-section">
          <h2>Information we collect</h2>
          <p>
            BrainBoost collects information you provide when creating an account
            (e.g., name, email, password, optional phone/address/date of birth)
            and learning activity generated while using the platform
            (e.g., enrolled courses, progress, test results). We may also collect
            basic technical data such as device/browser information and IP for
            security and analytics.
          </p>
        </section>

        <section id="how-we-use" className="legal-section">
          <h2>How we use your information</h2>
          <ul>
            <li>Provide and improve learning services and personalized paths.</li>
            <li>Authenticate users and prevent abuse or fraud.</li>
            <li>Send important notices about your account and courses.</li>
            <li>Understand usage to improve content and features.</li>
          </ul>
        </section>

        <section id="cookies" className="legal-section">
          <h2>Cookies & tracking</h2>
          <p>
            We use cookies and similar technologies to keep you signed in and
            remember preferences. You can control cookies via your browser
            settings, but some features may not work correctly without them.
          </p>
        </section>

        <section id="retention" className="legal-section">
          <h2>Data retention</h2>
          <p>
            We retain personal data for as long as needed to provide services and
            fulfill legal obligations. You may request deletion of your account —
            we’ll remove personal data unless we must keep it for legal reasons.
          </p>
        </section>

        <section id="rights" className="legal-section">
          <h2>Your rights</h2>
          <ul>
            <li>Access, correct, or delete your personal data.</li>
            <li>Export a copy of your data where applicable.</li>
            <li>Withdraw consent for optional communications at any time.</li>
          </ul>
        </section>

        <section id="children" className="legal-section">
          <h2>Children’s privacy</h2>
          <p>
            BrainBoost is designed for students with parental or school guidance.
            If you believe a child provided personal data without consent,
            please contact us to remove it.
          </p>
        </section>

        <section id="security" className="legal-section">
          <h2>Security</h2>
          <p>
            We employ administrative, technical, and physical safeguards to
            protect personal data. However, no method of transmission over the
            Internet is 100% secure.
          </p>
        </section>

        <section id="contact" className="legal-section">
          <h2>Contact</h2>
          <p>
            Questions about this policy? Reach us at
            {" "}
            <a href="mailto:brainboost.work@gmail.com">
              brainboost.work@gmail.com
            </a>.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}