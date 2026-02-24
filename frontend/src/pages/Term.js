import SiteHeader from "../components/Header";
import SiteFooter from "../components/Footer";
import "./legal.css";

export default function Terms() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      <SiteHeader />
      
      <main className="legal-page" style={{ flex: 1 }}>
        <header className="legal-header">
          <h1>Terms of Use</h1>
          <p className="updated">Last updated: 2025-09-03</p>
        </header>

        <nav className="legal-toc" aria-label="Table of contents">
          <strong>On this page</strong>
          <ul>
            <li><a href="#acceptance">1. Acceptance of Terms</a></li>
            <li><a href="#accounts">2. Accounts & Eligibility</a></li>
            <li><a href="#use">3. Acceptable Use</a></li>
            <li><a href="#courses">4. Courses, Fees & Payments</a></li>
            <li><a href="#content">5. User Content</a></li>
            <li><a href="#ip">6. Intellectual Property</a></li>
            <li><a href="#warranty">7. Disclaimers</a></li>
            <li><a href="#liability">8. Limitation of Liability</a></li>
            <li><a href="#changes">9. Changes to Terms</a></li>
            <li><a href="#law">10. Governing Law</a></li>
            <li><a href="#contact">11. Contact</a></li>
          </ul>
        </nav>

        <section id="acceptance" className="legal-section">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using BrainBoost, you agree to these Terms and our
            Privacy Policy. If you do not agree, please discontinue use.
          </p>
        </section>

        <section id="accounts" className="legal-section">
          <h2>2. Accounts & Eligibility</h2>
          <ul>
            <li>You must provide accurate information and keep your password secure.</li>
            <li>You are responsible for all activity under your account.</li>
            <li>We may suspend or terminate accounts that violate these Terms.</li>
          </ul>
        </section>

        <section id="use" className="legal-section">
          <h2>3. Acceptable Use</h2>
          <ul>
            <li>No illegal, fraudulent, or abusive activities.</li>
            <li>No reverse engineering or scraping without written consent.</li>
            <li>No sharing of paid content outside your personal learning use.</li>
          </ul>
        </section>

        <section id="courses" className="legal-section">
          <h2>4. Courses, Fees & Payments</h2>
          <p>
            Some courses may be paid. Prices and availability can change. Unless a
            specific refund policy is stated for a course, purchases are final.
            Access is personal and non-transferable.
          </p>
        </section>

        <section id="content" className="legal-section">
          <h2>5. User Content</h2>
          <p>
            You retain ownership of content you submit but grant BrainBoost a
            license to store and display it for providing the service. Do not post
            content that infringes others’ rights or violates the law.
          </p>
        </section>

        <section id="ip" className="legal-section">
          <h2>6. Intellectual Property</h2>
          <p>
            The platform, branding, and learning materials are owned by BrainBoost
            or its licensors. You may not copy, distribute, or create derivative
            works without permission.
          </p>
        </section>

        <section id="warranty" className="legal-section">
          <h2>7. Disclaimers</h2>
          <p>
            Services are provided “as is” without warranties of any kind. We do
            not guarantee uninterrupted or error-free operation.
          </p>
        </section>

        <section id="liability" className="legal-section">
          <h2>8. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, BrainBoost shall not be liable
            for any indirect or consequential damages arising out of your use of
            the service.
          </p>
        </section>

        <section id="changes" className="legal-section">
          <h2>9. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. Continued use after
            changes indicates acceptance of the updated Terms.
          </p>
        </section>

        <section id="law" className="legal-section">
          <h2>10. Governing Law</h2>
          <p>
            These Terms are governed by applicable local laws where BrainBoost is
            operated, without regard to conflict of law principles.
          </p>
        </section>

        <section id="contact" className="legal-section">
          <h2>11. Contact</h2>
          <p>
            Questions about these Terms? Contact us at{" "}
            <a href="mailto:brainboost.work@gmail.com">brainboost.work@gmail.com</a>.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}