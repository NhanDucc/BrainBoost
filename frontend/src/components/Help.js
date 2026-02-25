import { useState } from "react";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import FormulaEditor from "./FormulaEditor";
import FormulaDisplay from "./FormulaDisplay";
import "../css/Help.css";

// ==== Sub-Components ====

/**
 * FAQItem Component
 * Renders a single Frequently Asked Question as an interactive accordion item
 * @param {Object} props - Component properties
 * @param {String} props.question - The text of the FAQ question
 * @param {String} props.answer - The detailed answer
 * @param {Boolean} props.isOpen - Determines if the answer block is currently visible
 * @param {Function} props.onClick - Handler triggered when the question header is clicked
 */
const FAQItem = ({ question, answer, isOpen, onClick }) => {
    return (
        <div className="faq-item">
            <button className={`faq-question ${isOpen ? "active" : ""}`} onClick={onClick}>
                {question}
                <i className={`bi bi-chevron-${isOpen ? "up" : "down"}`}></i>
            </button>
            {isOpen && (
                <div className="faq-answer">
                    {answer}
                </div>
            )}
        </div>
    );
};

// ==== Main Component ====

/**
 * Help Component
 * Serves as the primary support page for users. Contains an FAQ section 
 * and an interactive tutorial for the mathematical Formula Editor
 */
export default function Help() {
    // ---- State Management ----

    // Tracks the index of the currently expanded FAQ item.
    const [openFAQ, setOpenFAQ] = useState(0);

    // Stores the user's input from the interactive math playground.
    const [practiceMath, setPracticeMath] = useState("");

    // ---- Event Handlers ----

    /**
     * Toggles the visibility of a specific FAQ item
     * If the clicked item is already open, it collapses it
     * Otherwise, it expands it
     * @param {Number} index - The array index of the clicked FAQ
     */
    const toggleFAQ = (index) => {
        setOpenFAQ(openFAQ === index ? -1 : index);
    };

    // ---- Static Data ----

    // Collection of Frequently Asked Questions to be rendered in the UI
    const faqs = [
        {
            q: "How do I start taking a test?",
            a: "Navigate to the 'Online Exam' tab in the top menu. Choose a subject, browse the available tests, and click on a test card to view its details. Once you are ready, click the 'Start Test' button. The timer will begin immediately."
        },
        {
            q: "How is my percentage score calculated?",
            a: "Your percentage score is calculated solely based on the Objective questions (Multiple Choice and True/False). The formula is: (Correct Answers / Total Gradable Questions) * 100. Essay questions are excluded from this percentage and are graded separately on a 10-point scale."
        },
        {
            q: "How does the AI grading for essay questions work?",
            a: "BrainBoost uses an advanced AI Agent to evaluate your written essays. When you click 'Grade with AI' on the result page, the AI compares your submission against the teacher's model answer and scoring rubric. It provides a score out of 10, detailed feedback on your strengths and weaknesses, and actionable suggestions for improvement."
        },
        {
            q: "Can I pause a test and come back later?",
            a: "Yes! If you accidentally close the tab or need to step away, your progress and timer are automatically saved to your local browser. Just reopen the same test, and you'll pick up exactly where you left off. However, if the timer runs out while you are away, the test will auto-submit."
        }
    ];

    // ---- Render Method ----

    return (
        <div className="help-page">
        <SiteHeader />
        
        <div className="help-container">
            <div className="help-header animate-fade">
                <h1>How can we help you?</h1>
                <p>Find answers to common questions and learn how to use BrainBoost tools.</p>
            </div>

            {/* ==== Section 1: FAQs ==== */}
            <section className="help-section animate-fade" style={{ animationDelay: '0.1s' }}>
                <h2><i className="bi bi-question-circle-fill"></i> Frequently Asked Questions</h2>
                <div className="faq-list">
                    {faqs.map((faq, index) => (
                    <FAQItem 
                        key={index}
                        question={faq.q}
                        answer={faq.a}
                        isOpen={openFAQ === index}
                        onClick={() => toggleFAQ(index)}
                    />
                    ))}
                </div>
            </section>

            {/* ==== Section 2: Math Formula Editor Tutorial ==== */}
            <section className="help-section animate-fade" style={{ animationDelay: '0.2s' }}>
                <h2><i className="bi bi-calculator"></i> Formula Editor Tutorial</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                    BrainBoost allows you to input complex mathematical formulas using our built-in MathLive editor. 
                    Here is a quick guide on how to use it effectively.
                </p>

                <div className="tutorial-box">
                    <strong>Method 1: Using the Visual Toolbar (For Beginners)</strong>
                    <p style={{ marginTop: '8px', marginBottom: '0' }}>
                        Click the <strong>Insert Formula</strong> button. A math input box will appear. Click inside the box, then click the small menu icon (☰) to open the visual keyboard and template library to select fractions, matrices, or exponents.
                    </p>
                </div>

                <div className="tutorial-box">
                    <strong>Method 2: Using LaTeX Shortcuts (For Advanced Users)</strong>
                    <p style={{ marginTop: '8px', marginBottom: '8px' }}>
                        You can type standard LaTeX commands directly into the math box. The editor will automatically format them:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        <li>Type <code>\sqrt</code> to create a square root: {"$\\sqrt{x}$"}</li>
                        <li>Type <code>\frac</code> to create a fraction: {"$\\frac{x}{y}$"}</li>
                        <li>Type <code>^</code> to create a superscript/exponent: $x^2$</li>
                        <li>Type <code>_</code> to create a subscript: $x_1$</li>
                    </ul>
                </div>

                {/* Interactive Playground for users to test formula rendering */}
                <div className="practice-area">
                    <h4><i className="bi bi-controller"></i> Practice Playground</h4>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Try typing some text and inserting a formula below to see how it works!</p>
                    
                    <FormulaEditor 
                        value={practiceMath} 
                        onChange={setPracticeMath} 
                        placeholder="Type here..."
                    />

                    <div className="practice-preview">
                        <strong>Preview:</strong>
                        <div style={{ marginTop: '10px' }}>
                            {practiceMath ? <FormulaDisplay content={practiceMath} /> : <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Your output will appear here...</span>}
                        </div>
                    </div>
                </div>
            </section>

            {/* Section 3: Contact Support */}
            <section className="help-section animate-fade" style={{ animationDelay: '0.3s', textAlign: 'center' }}>
                <h2><i className="bi bi-headset"></i> Still need help?</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                    If you couldn't find the answer you were looking for, our support team is ready to assist you.
                </p>
                <a href="/contact" className="primary-btn" style={{ textDecoration: 'none', display: 'inline-block', padding: '12px 24px' }}>
                    Contact Support
                </a>
            </section>
        </div>

        <SiteFooter />
        </div>
    );
}