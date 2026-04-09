import { useState, useEffect } from "react";
import SiteHeader from "./Header"
import SiteFooter from "./Footer"
import defaultAvatar from "../images/defaultAvatar.png";
import skillsPlaceholder from "../images/skills-placeholder.png";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import "../css/HomePage.css";

/**
 * HomePage Component
 * Serves as the landing page of the BrainBoost platform.
 * Features an AI-powered Learning Path generator, dynamic featured courses fetched from the backend, 
 * platform benefits, and student testimonials.
 */
const HomePage = () => {
  const navigate = useNavigate();

  // ==== State Management ====

  // ---- AI Learning Path States ----
  const [goal, setGoal] = useState("");
  const [pathResult, setPathResult] = useState(null);
  const [loadingPath, setLoadingPath] = useState(false);
  const [isSavingPath, setIsSavingPath] = useState(false);
  const [pathSaved, setPathSaved] = useState(false);

  // ---- Featured Courses States ----
  // Initializes an object grouping courses by subject to easily render categorized rows
  const [featuredCourses, setFeaturedCourses] = useState({
    math: [], english: [], physics: [], chemistry: []
  });
  const [loadingCourses, setLoadingCourses] = useState(true);

  // ==== Data Fetching ====

  /**
   * Fetches public courses from the backend on component mount.
   * Groups the fetched courses by subject and limits each category to the 3 most recent courses.
   */
  useEffect(() => {
    const fetchFeaturedCourses = async () => {
      try {
        setLoadingCourses(true);
        
        // Fetch all published courses from the public API endpoint
        const res = await api.get('/courses/public');
        const allCourses = Array.isArray(res.data) ? res.data : [];

        // Temporary object to group courses by subject, capped at 3 courses per subject
        const grouped = { math: [], english: [], physics: [], chemistry: [] };
        
        allCourses.forEach(course => {
          const subj = (course.subject || "").toLowerCase();
          // If the subject matches one of our keys and the array has less than 3 items, add it
          if (grouped[subj] && grouped[subj].length < 3) {
            grouped[subj].push(course);
          }
        });

        // Update state with the newly grouped data
        setFeaturedCourses(grouped);
      } catch (err) {
        console.error("Failed to fetch featured courses:", err);
      } finally {
        setLoadingCourses(false);
      }
    };

    fetchFeaturedCourses();
  }, []);

  // ==== UI Helper Components ====

  /**
   * Reusable UI Component for displaying a summarized course card on the homepage.
   */
  const CourseCard = ({ id, img, title, lessons, hours, price, onClick }) => (
    <article className="fc-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="fc-thumb">
        <img src={img || skillsPlaceholder} alt={title} />
      </div>

      <div className="fc-info">
        <h4 className="fc-title">{title}</h4>

        <div className="fc-meta">
          <span className="fc-meta-item">
            <i className="fc-ic fc-ic-lessons" /> {lessons || 0} lessons
          </span>
          <span className="fc-dot">•</span>
          <span className="fc-meta-item">
            <i className="fc-ic fc-ic-hours" /> {hours || 0} hours
          </span>
        </div>

        <div className="fc-price">
          {!price || price === 0 ? "Free" : `$${price}`}
        </div>
      </div>
    </article>
  );

  /**
   * Renders placeholder skeleton cards while courses are being fetched.
   * Prevents layout shift and provides visual feedback that data is loading.
   */
  const renderSkeletons = () => (
    <div className="fc-grid">
      {[1, 2, 3].map((i) => (
        <article key={i} className="fc-card" style={{ pointerEvents: 'none' }}>
          <div className="fc-thumb skeleton-box" style={{ height: '180px', borderRadius: '10px 10px 0 0' }}></div>
          <div className="fc-info">
            <div className="skeleton-box" style={{ height: '24px', width: '80%', marginBottom: '15px' }}></div>
            <div className="skeleton-box" style={{ height: '16px', width: '60%', marginBottom: '20px' }}></div>
            <div className="skeleton-box" style={{ height: '40px', width: '100%', borderRadius: '8px' }}></div>
          </div>
        </article>
      ))}
    </div>
  );

  /**
   * Helper function to render a complete Subject Section (e.g., Mathematics row).
   * Hides the entire section if no courses exist for that subject after loading completes.
   * * @param {String} subjectKey - The internal key for the subject (e.g., 'math')
   * @param {String} subjectTitle - The display name for the subject (e.g., 'Mathematics')
   */
  const renderSubjectSection = (subjectKey, subjectTitle) => {
    const courses = featuredCourses[subjectKey];
    
    // Completely hide the section if loading is done and there are no courses
    if (!loadingCourses && (!courses || courses.length === 0)) return null;

    return (
      <div key={subjectKey} style={{ marginBottom: '2rem' }}>
        <div className="fc-subject">
          <h3>{subjectTitle}</h3>
          {/* Navigate to the All Courses page with the specific subject pre-selected */}
          <button className="fc-more" onClick={() => navigate(`/courses?subject=${subjectKey}`)}>
            More <i className="bi bi-caret-right-fill"></i>
          </button>
        </div>
        
        {loadingCourses ? renderSkeletons() : (
          <div className="fc-grid">
            {courses.map(c => (
              <CourseCard
                key={c.id}
                id={c.id}
                img={c.coverUrl}
                title={c.title}
                lessons={c.lessons}
                hours={c.hours}
                price={c.priceUSD}
                onClick={() => navigate(`/courses/${c.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // ==== Event Handlers ====

  /**
   * Sends the user's goal to the AI backend to generate a personalized learning path.
   */
  const handleGeneratePath = async () => {
      if (!goal.trim()) return; // Prevent empty requests
      setLoadingPath(true);
      setPathSaved(false);  // Reset save state on new generation
      try {
          const res = await api.post('/courses/learning-path', { goal });
          setPathResult(res.data);
      } catch (err) {
          alert("Sorry, AI is busy right now. Please try again.");
      } finally {
          setLoadingPath(false);
      }
  };

  /**
   * Saves the generated learning path to the user's database profile.
   * Requires the user to be authenticated.
   */
  const handleSavePath = async () => {
      if (!pathResult) return;
      setIsSavingPath(true);
      try {
          await api.post('/learning/paths', {
              goal: goal,
              advice: pathResult.advice,
              path: pathResult.path
          });
          setPathSaved(true);
      } catch (error) {
          // If the backend returns 401 Unauthorized, prompt the user to log in
          if (error.response && error.response.status === 401) {
              alert("Please login to save this learning path.");
              navigate('/login');
          } else {
              alert("Failed to save path. Please try again.");
          }
      } finally {
          setIsSavingPath(false);
      }
  };

  // ==== Main Render ====

  return (
    <div className="homepage">
      {/* ==== Header ==== */}
      <SiteHeader />

      {/* ====  Hero Section ==== */}
      <section className="hero">
        <h1>BrainBoost - Boost Your Brainpower And Learning Efficiency</h1>
        <p>
          BrainBoost offers smart, AI-powered lessons in Math, English, Physics and Chemistry, helping students learn faster and smarter every day.
        </p>
      </section>

      {/* --- AI Learning Path Section --- */}
      <section className="lp-section">
          <h2 className="lp-title">Not sure where to start?</h2>
          <p className="lp-sub">Tell our AI Advisor your goals (e.g., "I want to master Grade 10 Math"), and we'll build a path for you.</p>
          
          <div className="lp-input-box">
              <textarea 
                  rows="3" 
                  placeholder="Ex: I am weak at Chemistry and want to prepare for the upcoming mid-term exam..." 
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
              />
              <button 
                  className="lp-btn" 
                  onClick={handleGeneratePath}
                  disabled={loadingPath}
              >
                  {loadingPath ? "Generating Path..." : "Get My Learning Path"}
              </button>
          </div>

          {/* Render the AI-generated learning path if data exists */}
          {pathResult && (
            <div className="lp-result">
              <div className="lp-advice">
                <i className="bi bi-chat-quote-fill" style={{marginRight:'10px'}}></i>
                {pathResult.advice}
              </div>

              <div className="path-list">
                {pathResult.path.map((item, index) => (
                  <div key={item.id} className="path-item">
                    <div className="path-step">{index + 1}</div>
                      <div className="path-content">
                        <h4>{item.title}</h4>
                        <p className="path-reason">💡 AI Suggestion: {item.reason}</p>
                        <div style={{fontSize:'14px', color:'#888', marginBottom:'8px'}}>
                          {item.subject} • Grade {item.grade}
                        </div>
                        <button 
                          className="path-go-btn" 
                          onClick={() => navigate(`/courses/${item.id}`)}
                        >
                          Start Learning →
                        </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Save Path Button */}
              <div style={{ textAlign: 'center', marginTop: '30px' }}>
                <button 
                  className="view-course-button" 
                  style={{ background: pathSaved ? '#16a34a' : '', boxShadow: pathSaved ? 'none' : '' }}
                  onClick={handleSavePath}
                  disabled={isSavingPath || pathSaved}
                >
                  {isSavingPath ? "Saving..." : pathSaved ? "Saved to My Learning Space" : "Save This Path"}
                </button>
              </div>
            </div>
          )}
      </section>

      {/* ==== Dynamic Featured Courses Section ==== */}
      <section className="featured">
        <h2 className="section-title">Featured Courses</h2>
        <p className="section-sub">
          Choose your favorite subject and start your journey of knowledge with BrainBoost.
        </p>

        {/* Dynamic rendering of course categories based on API data */}
        {renderSubjectSection("math", "Mathematics")}
        {renderSubjectSection("english", "English")}
        {renderSubjectSection("physics", "Physics")}
        {renderSubjectSection("chemistry", "Chemistry")}
        
        {/* If completely empty across all subjects, show a fallback message */}
        {!loadingCourses && Object.values(featuredCourses).every(arr => arr.length === 0) && (
            <p style={{textAlign: 'center', color: 'var(--text-secondary)'}}>More courses coming soon!</p>
        )}
      </section>

      {/* ==== Skills Gained Section ==== */}
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

      {/* ==== About Section ==== */}
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

      {/* ==== Why Study Section ==== */}
      <section className="why-section">
        <h2 className="why-title">Why should you study with BrainBoost</h2>

        <div className="why-container">
          <div className="why-image-left">
            <img src={skillsPlaceholder} alt="Why study with BrainBoost" />
          </div>

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


      {/* ==== Testimonials Section ==== */}
      <section className="testimonials-section" id="testimonials">
        <h2 className="t-title">Student Testimonials</h2>

        <div className="t-grid">
          <article className="t-card">
            <div className="t-header">
              <div className="t-avatar"><img src={defaultAvatar} alt="Nguyen Minh Anh" /></div>
              <div className="t-meta"><h4>Nguyen Minh Anh</h4><p className="t-sub">- Grade 11, Hanoi -</p></div>
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

          <article className="t-card">
            <div className="t-header">
              <div className="t-avatar"><img src={defaultAvatar} alt="Le Thanh Binh" /></div>
              <div className="t-meta"><h4>Le Thanh Binh</h4><p className="t-sub">- Grade 12, Da Nang -</p></div>
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

          <article className="t-card">
            <div className="t-header">
              <div className="t-avatar"><img src={defaultAvatar} alt="Tran Quynh Chi" /></div>
              <div className="t-meta"><h4>Tran Quynh Chi</h4><p className="t-sub">- Grade 7, Ho Chi Minh City -</p></div>
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

      {/* ==== Footer ==== */}
      <SiteFooter />
    </div>
  );
};

export default HomePage;