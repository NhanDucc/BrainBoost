import { useState, useEffect } from 'react';
import { api } from '../api';
import { useNavigate } from 'react-router-dom';
import '../css/BadgeCase.css';

const BadgeCase = () => {
    const navigate = useNavigate();

    // ==== State Management ====
    const [badges, setBadges] = useState([]);
    const [streaks, setStreaks] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Subject Tabs
    const [activeSubject, setActiveSubject] = useState('math');

    // Pagination States
    const [currentPage, setCurrentPage] = useState(1);
    const badgesPerPage = 12;

    // ==== Lifecycle Effects ====
    useEffect(() => {
        fetchBadges();
    }, []);

    // ==== API Calls ====
    const fetchBadges = async () => {
        try {
            const response = await api.get('/badges/my-badges');
            setBadges(response.data.badges);
            setStreaks(response.data.streaks);
            setLoading(false);
        } catch (err) {
            console.error("Error loading badge data:", err);
            setError("Unable to load badge data at this time.");
            setLoading(false);
        }
    };

    // ==== UI Render Helper ====
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    // ==== Pagination Logic ====
    const indexOfLastBadge = currentPage * badgesPerPage;
    const indexOfFirstBadge = indexOfLastBadge - badgesPerPage;
    const currentBadges = badges.slice(indexOfFirstBadge, indexOfLastBadge);
    const totalPages = Math.ceil(badges.length / badgesPerPage);

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
        window.scrollTo({ top: document.querySelector('.badges-grid').offsetTop - 100, behavior: 'smooth' });
    };

    if (loading) return <div className="badge-case-container"><h3>Loading Gamification data...</h3></div>;
    if (error) return <div className="badge-case-container"><h3 className="error">{error}</h3></div>;

    // Calculate badge collection progress
    const earnedCount = badges.filter(b => b.isEarned).length;
    const totalCount = badges.length;

    // List of subjects to render Tabs
    const subjects = [
        { id: 'math', label: 'Mathematics' },
        { id: 'physics', label: 'Physics' },
        { id: 'chemistry', label: 'Chemistry' },
        { id: 'english', label: 'English' }
    ];

    // Get the streak object for the currently selected subject
    const currentSubjectStreaks = streaks?.[activeSubject] || {};

    // ==== Render ====

    return (
        <div className="badge-case-container">
            {/* ==== Hero Header ==== */}
            <div className="badge-case-header">
                <button className="back-to-profile-btn" onClick={() => navigate('/profile')}>
                    <i className="bi bi-arrow-left"></i> Back to Profile
                </button>

                <div className="header-icon"> <i className="bi bi-trophy-fill"></i> </div>
                <h2>Achievements</h2>
                <p>Strive every day to conquer Mastery-based badges</p>
                
                <div className="badge-progress-pill">
                    <i className="bi bi-star-fill text-warning" style={{ marginRight: '6px' }}></i> 
                    Collected: {earnedCount} / {totalCount} badges
                </div>
            </div>

            {/* ==== Streaks Board ==== */}
            {streaks && (
                <div className="streaks-board">
                    {/* Subject Selection Tab Bar */}
                    <div className="subject-tabs">
                        {subjects.map(sub => (
                            <button 
                                key={sub.id} 
                                className={`subject-tab ${activeSubject === sub.id ? 'active' : ''}`}
                                onClick={() => setActiveSubject(sub.id)}
                            >
                                {sub.label}
                            </button>
                        ))}
                    </div>

                    {/* Grid of 4 stats for the selected subject */}
                    <div className="streaks-grid">
                        <div className="streak-item">
                            <div className="streak-icon"><i className="bi bi-lightning-charge-fill text-warning"></i></div>
                            <h4>Multiple Choice (MCQ)</h4>
                            <div className="streak-count">{currentSubjectStreaks.mcq?.current || 0} correct</div>
                            <div className="streak-highest">Record: {currentSubjectStreaks.mcq?.highest || 0}</div>
                        </div>
                        
                        <div className="streak-item">
                            <div className="streak-icon"><i className="bi bi-shield-check text-success"></i></div>
                            <h4>True / False</h4>
                            <div className="streak-count">{currentSubjectStreaks.tf?.current || 0} correct</div>
                            <div className="streak-highest">Record: {currentSubjectStreaks.tf?.highest || 0}</div>
                        </div>

                        <div className="streak-item">
                            <div className="streak-icon"><i className="bi bi-pencil-square text-primary"></i></div>
                            <h4>Short Answer</h4>
                            <div className="streak-count">{currentSubjectStreaks.short_answer?.current || 0} correct</div>
                            <div className="streak-highest">Record: {currentSubjectStreaks.short_answer?.highest || 0}</div>
                        </div>

                        <div className="streak-item">
                            <div className="streak-icon"><i className="bi bi-journal-text text-danger"></i></div>
                            <h4>Essay</h4>
                            <div className="streak-count">{currentSubjectStreaks.essay?.current || 0} correct</div>
                            <div className="streak-highest">Record: {currentSubjectStreaks.essay?.highest || 0}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* ==== Badges Grid ==== */}
            <div className="badges-grid">
                {badges.length === 0 ? (
                    <p>There are no badges in the system yet.</p>
                ) : (
                    currentBadges.map(badge => (
                        <div key={badge._id} className={`badge-card ${badge.isEarned ? 'earned' : 'locked'}`}>
                            <div className="badge-image-wrapper">
                                {badge.iconUrl ? (
                                    <img src={badge.iconUrl} alt={badge.name} className="badge-icon" />
                                ) : (
                                    <i className="bi bi-award-fill badge-icon" style={{ fontSize: '60px', color: '#fbbf24' }}></i>
                                )}
                            </div>
                            <h3 className="badge-title">{badge.name}</h3>
                            <p className="badge-desc">{badge.description}</p>
                            
                            {badge.isEarned && (
                                <div className="badge-date">
                                    Earned on: {formatDate(badge.earnedAt)}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* ==== Pagination Controls ==== */}
            {totalPages > 1 && (
                <div className="pagination-container">
                    <button 
                        className="page-btn" 
                        disabled={currentPage === 1} 
                        onClick={() => handlePageChange(currentPage - 1)}
                    >
                        <i className="bi bi-chevron-left"></i> Prev
                    </button>
                    
                    {/* Display page number */}
                    {[...Array(totalPages)].map((_, i) => (
                        <button 
                            key={i + 1} 
                            className={`page-btn ${currentPage === i + 1 ? 'active' : ''}`}
                            onClick={() => handlePageChange(i + 1)}
                        >
                            {i + 1}
                        </button>
                    ))}

                    <button 
                        className="page-btn" 
                        disabled={currentPage === totalPages} 
                        onClick={() => handlePageChange(currentPage + 1)}
                    >
                        Next <i className="bi bi-chevron-right"></i>
                    </button>
                </div>
            )}
        </div>
    );
};

export default BadgeCase;