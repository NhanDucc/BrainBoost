import React from "react";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import "../css/AboutUs.css";
import { useNavigate } from "react-router-dom";
import skillsPlaceholder from "../images/skills-placeholder.png";

export default function AboutUs() {
    const navigate = useNavigate();

    return (
        <div className="about-page">
            <SiteHeader />

            <main className="about-container-2">
                {/* lead */}
                <section className="about-lead">
                    <p>BrainBoost is growing into a place that has <b>everything</b> you need to study and get exam-ready <br></br>— <b>all from the comfort of your home</b>.</p>
                </section>

                {/* big promise + framed image */}
                <section className="about-promise">
                    <h2>
                        The only thing you need to do is go to school to take the exam.
                        <br></br>We’ll take care of the rest!
                    </h2>

                    <figure className="frame-slab">
                        <div className="slab-inner">
                            <img src={skillsPlaceholder} alt="Overview" />
                        </div>
                    </figure>
                </section>

                {/* mission */}
                <section className="about-mission">
                    <h2>Our Mission at BrainBoost</h2>
                    <div className="mission-grid">
                        <article className="mission-card">
                            <div className="mission-thumb">
                                <img src={skillsPlaceholder} alt="Build community" />
                            </div>
                            <h3>Build a Learning Community</h3>
                            <p>Connect students nationwide and create a space for sharing knowledge.</p>
                        </article>

                        <article className="mission-card">
                            <div className="mission-thumb">
                                <img src={skillsPlaceholder} alt="Improve quality" />
                            </div>
                            <h3>Improve Quality</h3>
                            <p>We constantly update our content and methods to reflect real-world scenarios.</p>
                        </article>

                        <article className="mission-card">
                            <div className="mission-thumb">
                                <img src={skillsPlaceholder} alt="AI-powered" />
                            </div>
                            <h3>AI-powered Support</h3>
                            <p>AI Tutor gives instant help and tailors learning to each student.</p>
                        </article>

                        <article className="mission-card">
                            <div className="mission-thumb">
                                <img src={skillsPlaceholder} alt="Inspire" />
                            </div>
                            <h3>Inspire Students</h3>
                            <p>We aim to foster curiosity and a love for learning in every child.</p>
                        </article>
                    </div>
                </section>

                {/* traits */}
                <section className="traits">
                    <h4>Do you have any of these traits?</h4>
                    <div className="traits-grid">
                        <div className="trait-card">
                            <div className="trait-img"><img src={skillsPlaceholder} alt="" /></div>
                            <p>Struggling to find a reliable place to prepare for exams.</p>
                        </div>

                        <div className="trait-card">
                            <div className="trait-img"><img src={skillsPlaceholder} alt="" /></div>
                            <p>Want to study on your own schedule, at your own pace, without a fixed class.</p>
                        </div>

                        <div className="trait-card">
                            <div className="trait-img"><img src={skillsPlaceholder} alt="" /></div>
                            <p>Capable of self-study, but overwhelmed by too many materials and information.</p>
                        </div>
                    </div>
                </section>

                {/* overlay banner */}
                <section className="overlay-hero">
                    <img src={skillsPlaceholder} alt="Story" className="oh-bg"/>
                    <div className="oh-inner">
                        <p className="oh-kicker">BrainBoost was created out of our team’s absolute belief in one thing:</p>
                        <h1>With strong <span className="hl">self-discipline</span> ,<br/> you have everything it takes to prepare for exams and <span className="hl hl-lg">succeed—right</span> from home!</h1>
                    </div>
                </section>

                {/* finder + study */}
                <section className="finder-study">
                    <div className="fs-head">
                        <h2>What can you find in BrainBoost?</h2>
                        <p>BrainBoost offers two core product lines that our team has poured immense time, effort, and passion into building.</p>
                    </div>
                    
                    <div className="fs-grid">
                        <a className="fs-card free" href="/tests">
                            <div className="fs-badge">Free practice</div>
                            <h3>
                                <span>Practice</span>
                                <strong>Free</strong>
                            </h3>
                        </a>

                        <a className="fs-card paid" href="/courses">
                            <div className="fs-badge">Paid product</div>
                            <h3>
                                <span>Courses</span>
                                <strong>BrainBoost</strong>
                            </h3>
                        </a>
                    </div>
                </section>

                {/* student */}
                <section className="student-row">
                    <div className="student-img">
                        <img src={skillsPlaceholder} alt="Student" />
                    </div>

                    <div className="student-col">
                        <h2>Become a BrainBoost Student</h2>
                        <p>Join BrainBoost's student community, we’re committed to providing students with the most valuable knowledge.</p>
                        <ul className="check-list">
                            <li><span className="check-icon">✔</span> 24/7 access to lessons and AI support</li>
                            <li><span className="check-icon">✔</span> Courses for Grade 1 → Grade 12</li>
                            <li><span className="check-icon">✔</span> Expert teachers & interactive exercises</li>
                            <li><span className="check-icon">✔</span> Flexible learning for every student’s pace</li>
                        </ul>
                        <button className="cta-btn" onClick={() => navigate('/register')}>Sign Up Now</button>
                    </div>
                </section>

                {/* teacher */}
                <section className="teacher-row">
                    <div className="teacher-col">
                        <h2>Become a BrainBoost Teacher</h2>
                        <p>BrainBoost continuously recruits talented teachers who are passionate about teaching with attractive remuneration.</p>
                        <button className="cta-btn" onClick={() => navigate('/apply-instructor')}>Sign Up Now</button>
                    </div>

                    <div className="teacher-img">
                        <img src={skillsPlaceholder} alt="Teacher" />
                    </div>
                </section>


            </main>

            <SiteFooter />
        </div>
    );
}
