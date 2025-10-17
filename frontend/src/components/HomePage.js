import React, {use, useEffect, useState} from "react";
import SiteHeader from "./Header"
import SiteFooter from "./Footer"
import "../css/HomePage.css";
import defaultAvatar from "../images/defaultAvatar.png";
import skillsPlaceholder from "../images/skills-placeholder.png";
import { useNavigate } from "react-router-dom";

const HomePage = () => {
  const navigate = useNavigate();

  const CourseCard = ({ img, title, lessons, hours, price = "$40" }) => (
  <article className="fc-card">
    <div className="fc-thumb">
      <img src={img} alt="" />
    </div>

    <div className="fc-info">
      <h4 className="fc-title">{title}</h4>

      <div className="fc-meta">
        <span className="fc-meta-item">
          <i className="fc-ic fc-ic-lessons" /> {lessons} lessons
        </span>
        <span className="fc-dot">•</span>
        <span className="fc-meta-item">
          <i className="fc-ic fc-ic-hours" /> {hours} hours
        </span>
      </div>

      <div className="fc-price">{price}</div>
    </div>
  </article>
  );

  return (
    <div className="homepage">
      {/* HEADER */}
      <SiteHeader />

      {/* HERO SECTION */}
      <section className="hero">
        <h1>BrainBoost - Boost Your Brainpower And Learning Efficiency</h1>
        <p>
          BrainBoost offers smart, AI-powered lessons in Math, English, Physics and Chemistry, helping students learn faster and smarter every day.
        </p>
      </section>

      {/* LEARNING PATH */}
      <section className="learning-path" id="learning-path">
        <h2 className="lp-title">Learning Path</h2>
        <p className="lp-sub">
          Choose a learning path for Math, English, Physics, Chemistry or let AI suggest a personalized plan.
        </p>

        <div className="lp-grid">
          <div className="subject-card">
            <div className="subject-title">Mathematics</div>
            <div className="subject-desc">
              From basic to advanced: Algebra, Geometry, Calculus.
            </div>
          </div>

          <div className="subject-card">
            <div className="subject-title">English</div>
            <div className="subject-desc">
              Grammar, Vocabulary, Reading and Writing Skills.
            </div>
          </div>

          <div className="subject-card">
            <div className="subject-title">Physics</div>
            <div className="subject-desc">
              Mechanics, Electricity, Optics and Applied Exercises.
            </div>
          </div>

          <div className="subject-card">
            <div className="subject-title">Chemistry</div>
            <div className="subject-desc">
              Inorganic & Organic Chemistry, Reactions and Calculations.
            </div>
          </div>
        </div>

        <button className="ai-button">Use AI to Design Custom Itineraries</button>
      </section>

      {/* FEATURED COURSES */}
      <section className="featured">
        <h2 className="section-title">Featured Courses</h2>
        <p className="section-sub">
          Choose your favorite subject and start your journey of knowledge with BrainBoost.
        </p>

        {/* Mathematics */}
        <div className="fc-subject">
          <h3>Mathematics</h3>
          <a className="fc-more" href="/courses/math">More <span>›</span></a>
        </div>
        <div className="fc-grid">
          <CourseCard
            img={skillsPlaceholder}
            title="Advanced Math Grade 12 – University Entrance Prep 2025"
            lessons="60"
            hours="56"
            price="$40"
          />
          <CourseCard
            img={skillsPlaceholder}
            title="Calculus from Basics to Advanced"
            lessons="45"
            hours="35"
            price="$40"
          />
        </div>

        {/* English */}
        <div className="fc-subject">
          <h3>English</h3>
          <a className="fc-more" href="/courses/english">More <span>›</span></a>
        </div>
        <div className="fc-grid">
          <CourseCard
            img={skillsPlaceholder}
            title="English Mastery – Comprehensive Grammar for High School"
            lessons="55"
            hours="60"
          />
          <CourseCard
            img={skillsPlaceholder}
            title="Accelerate 1,000+ Vocabulary Words for University Exams"
            lessons="40"
            hours="45"
          />
        </div>

        {/* Physics */}
        <div className="fc-subject">
          <h3>Physics</h3>
          <a className="fc-more" href="/courses/physics">More <span>›</span></a>
        </div>
        <div className="fc-grid">
          <CourseCard
            img={skillsPlaceholder}
            title="Physics Grade 12 – Intensive Exam Prep"
            lessons="50"
            hours="48"
          />
          <CourseCard
            img={skillsPlaceholder}
            title="Golden Formulas – Solve Every Physics Question Faster"
            lessons="25"
            hours="30"
          />
        </div>

        {/* Chemistry */}
        <div className="fc-subject">
          <h3>Chemistry</h3>
          <a className="fc-more" href="/courses/chemistry">More <span>›</span></a>
        </div>
        <div className="fc-grid">
          <CourseCard
            img={skillsPlaceholder}
            title="Chemistry Essentials – University Exam Review 2025"
            lessons="55"
            hours="52"
          />
          <CourseCard
            img={skillsPlaceholder}
            title="Organic Reactions – Learn, Remember, Apply"
            lessons="35"
            hours="28"
          />
        </div>
      </section>

      {/* SKILLS GAINED */}
      <section className="skills-section">
        <div className="skills-container">
          <div className="skills-image">
            <img src={skillsPlaceholder} alt="Skills Visual" />
          </div>
          <div className="skills-content">
            <h2>Skills Students Gain from BrainBoost Courses</h2>
            <p>
              With high-quality lessons, diverse exercises, and 24/7 support from the AI Tutor, BrainBoost helps students develop valuable skills for learning and life.
            </p>
            <ul className="skill-list">
              <li><span className="check-icon">✔</span> Build a solid knowledge foundation in Math, English, Physics, and Chemistry.</li>
              <li><span className="check-icon">✔</span> Improve problem-solving skills through practice and real-life scenarios.</li>
              <li><span className="check-icon">✔</span> Develop critical thinking and analytical skills, enabling deeper understanding.</li>
              <li><span className="check-icon">✔</span> Foster active and confident learning habits with AI-powered personalized paths.</li>
            </ul>
            <button type="button" className="view-course-button" onClick={() => navigate('/courses')} >View Course</button>
          </div>
        </div>
      </section>

      {/* ABOUT SECTION */}
      <section className="about-section">
        <div className="about-container">
          <div className="about-image">
            <img src={skillsPlaceholder} alt="About BrainBoost Visual" />
          </div>
          <div className="about-content">
            <h2>About BrainBoost</h2>
            <p>
              BrainBoost is an online learning platform designed to provide students from primary to high school with a modern and effective study experience. We focus on core subjects such as Mathematics, English, Physics, and Chemistry, combined with an AI Tutor that helps answer questions and create personalized learning paths for each student.
            </p>
            <p>
              BrainBoost is committed to innovating teaching methods, continuously updating content, listening to feedback from students and parents, and improving every detail to deliver the highest quality courses – helping students not only understand lessons faster but also foster a genuine passion for learning and develop critical thinking skills throughout their educational journey from elementary to high school.
            </p>
          </div>
        </div>
      </section>

      {/* WHY STUDY SECTION */}
      <section className="why-section">
        <h2 className="why-title">Why should you study with BrainBoost</h2>

        <div className="why-container">
          {/* Left big image */}
          <div className="why-image-left">
            <img src={skillsPlaceholder} alt="Why study with BrainBoost" />
          </div>

          {/* Right cards */}
          <div className="why-right">
            <article className="why-card">
              <div className="why-thumb">
                <img src={skillsPlaceholder} alt="" />
              </div>
              <div className="why-card-body">
                <h3>High Quality</h3>
                <p>
                  All course content is carefully designed with both depth and quality in mind.
                  Lessons are created by experienced teachers and enhanced with an AI Tutor to
                  provide instant support, ensuring every learner gets the best guidance.
                </p>
              </div>
            </article>

            <article className="why-card">
              <div className="why-thumb">
                <img src={skillsPlaceholder} alt="" />
              </div>
              <div className="why-card-body">
                <h3>Essential Skills</h3>
                <p>
                  BrainBoost courses help students build problem-solving abilities, logical thinking,
                  and analytical skills across subjects like Math, English, Physics, and Chemistry —
                  skills that benefit learning in school and life beyond the classroom.
                </p>
              </div>
            </article>

            <article className="why-card">
              <div className="why-thumb">
                <img src={skillsPlaceholder} alt="" />
              </div>
              <div className="why-card-body">
                <h3>Strong Preparation for the Future</h3>
                <p>
                  From elementary to high school, BrainBoost gives students a solid foundation for
                  advanced learning, exams, and future studies. Each course equips learners with
                  confidence and habits that support them throughout their educational journey.
                </p>
              </div>
            </article>
          </div>
        </div>
      </section>


      {/* TESTIMONIALS */}
      <section className="testimonials-section" id="testimonials">
        <h2 className="t-title">Student Testimonials</h2>

        <div className="t-grid">
          {/* Card 1 */}
          <article className="t-card">
            <div className="t-header">
              <div className="t-avatar">
                <img src={defaultAvatar} alt="Nguyen Minh Anh" />
              </div>
              <div className="t-meta">
                <h4>Nguyen Minh Anh</h4>
                <p className="t-sub">- Grade 11, Hanoi -</p>
              </div>
            </div>

            <p className="t-text">
              BrainBoost makes studying Math and Physics so much easier! The AI Tutor
              explains every step clearly, and the practice exercises are really helpful.
              I feel more confident every time I go to class.
            </p>

            <div className="t-stars" aria-label="5 out of 5">
              <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
            </div>
          </article>

          {/* Card 2 */}
          <article className="t-card">
            <div className="t-header">
              <div className="t-avatar">
                <img src={defaultAvatar} alt="Le Thanh Binh" />
              </div>
              <div className="t-meta">
                <h4>Le Thanh Binh</h4>
                <p className="t-sub">- Grade 12, Da Nang -</p>
              </div>
            </div>

            <p className="t-text">
              English used to be my weakest subject, but thanks to BrainBoost, I can now
              write essays and understand reading passages much better. The lessons are
              fun, and the AI chat helps me whenever I get stuck.
            </p>

            <div className="t-stars" aria-label="5 out of 5">
              <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
            </div>
          </article>

          {/* Card 3 */}
          <article className="t-card">
            <div className="t-header">
              <div className="t-avatar">
                <img src={defaultAvatar} alt="Tran Quynh Chi" />
              </div>
              <div className="t-meta">
                <h4>Tran Quynh Chi</h4>
                <p className="t-sub">- Grade 7, Ho Chi Minh City -</p>
              </div>
            </div>

            <p className="t-text">
              I love how BrainBoost combines learning and fun. Chemistry experiments are
              explained so clearly, and I finally understand how everything connects.
              It’s like having a private tutor at home!
            </p>

            <div className="t-stars" aria-label="5 out of 5">
              <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
            </div>
          </article>
        </div>
      </section>

      {/* FOOTER */}
      <SiteFooter />
    </div>
  );
};

export default HomePage;
