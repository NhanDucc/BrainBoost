import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { api } from "../api";
import defaultAvatar from "../images/defaultAvatar.png";
import "../css/Leaderboard.css";

export default function Leaderboard() {
    const { id } = useParams(); // Test ID từ URL
    const navigate = useNavigate();
    
    const [testInfo, setTestInfo] = useState(null);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchLeaderboardData = async () => {
            try {
                // Lấy thông tin bài test (để hiển thị Title)
                const testRes = await api.get(`/tests/public/${id}`);
                setTestInfo(testRes.data);

                // Lấy dữ liệu bảng xếp hạng
                const lbRes = await api.get(`/tests/public/${id}/leaderboard`);
                setLeaderboard(lbRes.data);
            } catch (err) {
                setError("Failed to load leaderboard data.");
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboardData();
    }, [id]);

    return (
        <div className="leaderboard-page">
            <SiteHeader />
            
            <div className="lb-container">
                <div className="lb-header animate-fade">
                    <button className="ghost-btn" onClick={() => navigate(-1)} style={{ marginBottom: '20px' }}>
                        <i className="bi bi-arrow-left"></i> Back
                    </button>
                    <h1><i className="bi bi-trophy-fill text-warning"></i> Hall of Fame</h1>
                    {loading ? (
                        <p>Loading ranking data...</p>
                    ) : error ? (
                        <p style={{ color: 'var(--error)' }}>{error}</p>
                    ) : (
                        <p>Top performers for <strong>{testInfo?.title || "this test"}</strong></p>
                    )}
                </div>

                {!loading && !error && (
                    <div className="lb-card animate-fade" style={{ animationDelay: '0.1s' }}>
                        {leaderboard.length === 0 ? (
                            <div className="lb-empty">
                                <i className="bi bi-inbox" style={{ fontSize: '40px', opacity: 0.5, display: 'block', marginBottom: '10px' }}></i>
                                No one has taken this test yet. Be the first to conquer it!
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table className="lb-table">
                                    <thead>
                                        <tr>
                                            <th className="lb-rank">Rank</th>
                                            <th>Student</th>
                                            <th>Score</th>
                                            <th>Time Spent</th>
                                            <th>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {leaderboard.map((entry, idx) => {
                                            // Xử lý logic ẩn danh (Privacy)
                                            const isAnon = entry.isAnonymous;
                                            const displayName = isAnon ? "Anonymous Student" : entry.user;
                                            const displayAvatar = isAnon ? defaultAvatar : (entry.avatar || defaultAvatar);
                                            const displayDate = new Date(entry.date).toLocaleDateString();

                                            return (
                                                <tr key={idx} className={idx < 3 ? `top-${idx+1}` : ''}>
                                                    <td className="lb-rank">
                                                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                                                    </td>
                                                    <td className="lb-user">
                                                        <img 
                                                            src={displayAvatar} 
                                                            alt="avatar" 
                                                            onError={(e) => { e.target.onerror = null; e.target.src = defaultAvatar; }}
                                                        />
                                                        <span>{displayName}</span>
                                                    </td>
                                                    <td className="lb-score">{entry.score} / {entry.maxScore}</td>
                                                    <td>{entry.timeSpent} mins</td>
                                                    <td style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{displayDate}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <SiteFooter />
        </div>
    );
}