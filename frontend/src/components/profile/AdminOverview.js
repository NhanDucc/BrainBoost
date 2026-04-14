import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";

export default function AdminOverview() {
    const navigate = useNavigate();

    // ---- State Management ----
    const [adminData, setAdminData] = useState(null);
    const [unreadMsgs, setUnreadMsgs] = useState([]);

    // ---- Data Fetching ----

    // Fetches dashboard statistics and unread messages when the component mounts
    useEffect(() => {
        api.get("/admin/stats").then(res => setAdminData(res.data)).catch(() => {});
        api.get("/contact/unread").then(res => setUnreadMsgs(res.data)).catch(() => {});
    }, []);

    // ---- Handlers ----

    /**
     * Marks a specific support ticket as read.
     * Updates the backend and then removes the message from the local UI state.
     * @param {string} id - The unique ID of the message to mark as read.
     */
    const handleMarkMsgRead = async (id) => {
        try {
            await api.put(`/contact/${id}/read`);
            // Optimistic UI update: remove the read message from the current state array
            setUnreadMsgs(prev => prev.filter(m => m._id !== id));
        } catch (err) { 
            alert("Failed to mark as read"); 
        }
    };

    // Render a loading state until the primary KPI data is fetched successfully
    if (!adminData) return <div className="empty">Loading...</div>;

    // ---- Render UI ----
    
    return (
        <div className="role-section">
            
            {/* ==== Top Section: High-Level KPIs ==== */}
            <div className="role-cards-stats">
                <div className="stat-card">
                    <div className="stat-kpi">{adminData.kpis.totalUsers}</div>
                    <div className="stat-label">Total Students</div>
                </div>
                <div className="stat-card">
                    <div className="stat-kpi">{adminData.kpis.totalInstructors}</div>
                    <div className="stat-label">Instructors</div>
                </div>
                <div className="stat-card">
                    {/* Dynamically colors the KPI red if there are pending items requiring admin attention */}
                    <div className="stat-kpi" style={{ color: adminData.kpis.pendingApps > 0 ? 'var(--error)' : 'var(--primary)' }}>
                        {adminData.kpis.pendingApps}
                    </div>
                    <div className="stat-label">Pending Approvals</div>
                </div>
                <div className="stat-card">
                    <div className="stat-kpi">{adminData.kpis.totalContent}</div>
                    <div className="stat-label">Courses & Tests</div>
                </div>
            </div>

            {/* ==== Navigation Shortcut ==== */}
            <div className="role-card">
                <h3><i className="bi bi-lightning-charge-fill"></i> Command Center</h3>
                <div className="qa-row">
                    {/* Directs the admin to the full moderation workspace (AdminDashboard) */}
                    <button className="primary-btn" onClick={() => navigate("/admin")}>
                        <i className="bi bi-speedometer2"></i> Open Admin Workspace
                    </button>
                </div>
            </div>

            {/* ==== Main Content Grid: Tickets & Activity Logs ==== */}
            <div className="stu-grid" style={{ marginTop: '12px' }}>
                
                {/* Left Column: Unread Support Tickets */}
                <div className="col-left">
                    <div className="dash-card">
                        <div className="card-head">
                            <div className="title" style={{ fontSize: '20px' }}>
                                <i className="bi bi-envelope-exclamation-fill text-warning"></i> Unread Support Tickets
                            </div>
                            {/* Badge indicating the number of new/unread tickets */}
                            <span className="chip" style={{ background: 'var(--error)', color: '#fff' }}>
                                {unreadMsgs.length} New
                            </span>
                        </div>
                        <div className="msg-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                            {unreadMsgs.length === 0 ? (
                                // Empty state fallback
                                <div className="empty" style={{ padding: '20px' }}>All caught up! No unread messages.</div>
                            ) : (
                                // Map through and render each unread message
                                unreadMsgs.map(msg => (
                                    <div key={msg._id} className="recent-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '8px' }}>
                                            <strong>{msg.subject}</strong>
                                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                {new Date(msg.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                            From: {msg.user?.fullname}
                                        </div>
                                        <div style={{ background: 'var(--bg-input)', padding: '10px', borderRadius: '8px', fontSize: '14px', width: '100%', marginBottom: '12px' }}>
                                            {msg.message}
                                        </div>
                                        {/* Action button to resolve the ticket */}
                                        <button className="ghost-btn" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleMarkMsgRead(msg._id)}>
                                            <i className="bi bi-check2-all"></i> Mark as Read
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Platform Activity Log */}
                <div className="col-right">
                    <div className="dash-card">
                        <div className="card-head">
                            <div className="title" style={{ fontSize: '20px' }}>
                                <i className="bi bi-activity text-success"></i> Activity Log
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                            {adminData.recentActivity.length === 0 ? (
                                // Empty state fallback
                                <p className="role-muted">No recent activity.</p>
                            ) : (
                                // Map through and render recent platform events (e.g., new users, newly published content)
                                adminData.recentActivity.map(act => (
                                    <div key={act.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                        {/* Renders a dynamic icon depending on whether the activity relates to a 'user' or a 'document' */}
                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-object)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', flexShrink: 0 }}>
                                            <i className={act.type === 'user' ? "bi bi-person-plus-fill" : "bi bi-file-earmark-plus-fill"}></i>
                                        </div>
                                        <div>
                                            <div style={{ color: 'var(--text-main)', fontSize: '14px', fontWeight: '500' }}>
                                                {act.text}
                                            </div>
                                            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                                                {new Date(act.date).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
                
            </div>
        </div>
    );
}