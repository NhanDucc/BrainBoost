import React, { useEffect, useState } from 'react';
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { api } from '../api';
import '../css/Admin.css';

export default function AdminDashboard() {
    // ==== Navigation States ====
    const [activeTab, setActiveTab] = useState('users');     
    const [subStatus, setSubStatus] = useState('pending'); 
    
    // ==== Data & UI States ====
    const [dataList, setDataList] = useState([]);          
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState({ text: '', type: 'success' });

    // ==== User Management States ====
    const [userSearch, setUserSearch] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState('all');

    // ==== Custom Modal States ====
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false, title: '', message: '', isDanger: true, onConfirm: null
    });
    const [rejectModal, setRejectModal] = useState({ isOpen: false, id: null }); 
    const [rejectNote, setRejectNote] = useState('');                            
    const [approveModal, setApproveModal] = useState({ isOpen: false, id: null });
    const [approveNote, setApproveNote] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);                     

    // Broadcast feature state
    const [broadcastModal, setBroadcastModal] = useState({ isOpen: false, title: '', message: '' });
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    // ==== Data Fetching ====
    
    /**
     * Fetches data based on the currently active tab and sub-status filter.
     */
    const loadData = async () => {
        setLoading(true);
        try {
            let res;
            if (activeTab === 'users') {
                res = await api.get('/admin/users');
                let users = res.data || [];
                // Apply client-side filtering for users
                if (userRoleFilter !== 'all') users = users.filter(u => u.role === userRoleFilter);
                if (userSearch.trim()) {
                    const q = userSearch.toLowerCase();
                    users = users.filter(u => u.fullname?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
                }
                setDataList(users);
            } else if (activeTab === 'applications') {
                const statusQuery = subStatus === 'approved' ? 'approved' : subStatus;
                res = await api.get(`/admin/instructors/applications?status=${statusQuery}`);
                setDataList(res?.data || []);
            } else if (activeTab === 'courses') {
                const statusQuery = subStatus === 'approved' ? 'published' : subStatus;
                res = await api.get(`/courses/admin/list?status=${statusQuery}`);
                setDataList(res?.data || []);
            } else if (activeTab === 'tests') {
                const statusQuery = subStatus === 'approved' ? 'published' : subStatus;
                res = await api.get(`/tests/admin/list?status=${statusQuery}`);
                setDataList(res?.data || []);
            }
        } catch (error) {
            console.error("Fetch error", error);
            showMessage('Failed to load data.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Debounce effect: Waits 300ms after the user stops typing/clicking before fetching data
    useEffect(() => { 
        const delay = setTimeout(() => { loadData(); }, 300);
        return () => clearTimeout(delay);
        /* eslint-disable-next-line */ 
    }, [activeTab, subStatus, userSearch, userRoleFilter]);

    /**
     * Helper to show a temporary toast notification.
     * Auto-hides after 3 seconds.
     * @param {string} text - The message to display.
     * @param {string} type - 'success' or 'error'.
     */
    const showMessage = (text, type = 'success') => {
        setMsg({ text, type });
        setTimeout(() => setMsg({ text: '', type: '' }), 3000);
    };

    // ==== User Management Handlers ====

    /**
     * Intercepts role change attempts. 
     * Triggers a warning modal if granting Admin rights to prevent accidental privilege escalation.
     */
    const handleRoleChangeRequest = (userId, newRole) => {
        if (newRole === 'admin') {
            setConfirmModal({
                isOpen: true,
                title: 'Grant Admin Privileges',
                message: 'WARNING: Are you sure you want to grant ADMIN privileges to this user? They will have full access to the entire system.',
                isDanger: false,
                onConfirm: () => executeRoleChange(userId, newRole)
            });
        } else {
            executeRoleChange(userId, newRole);
        }
    };

    /**
     * Executes the API call to update a user's role.
     */
    const executeRoleChange = async (userId, newRole) => {
        try {
            await api.patch(`/admin/users/${userId}/role`, { role: newRole });
            showMessage(`User role successfully updated to ${newRole}`);
            setDataList(dataList.map(u => u._id === userId ? { ...u, role: newRole } : u));
        } catch (err) { 
            showMessage('Failed to update role. Please try again.', 'error'); 
        } finally {
            setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
        }
    };

    /**
     * Intercepts delete user attempts. 
     * Blocks deletion of other admins and opens a confirmation modal for normal users.
     */
    const handleDeleteUserRequest = (userId, fullname, role) => {
        if (role === 'admin') {
            showMessage("ACTION DENIED: You cannot delete an Administrator account.", "error");
            return;
        }
        setConfirmModal({
            isOpen: true,
            title: 'Delete User Account',
            message: `Are you sure you want to permanently delete the user: "${fullname}"? All their data will be lost. This action cannot be undone.`,
            isDanger: true,
            onConfirm: () => executeDeleteUser(userId, fullname)
        });
    };

    /**
     * Executes the API call to permanently delete a user.
     */
    const executeDeleteUser = async (userId, fullname) => {
        try {
            await api.delete(`/admin/users/${userId}`);
            showMessage(`User "${fullname}" has been deleted successfully.`);
            setDataList(dataList.filter(u => u._id !== userId));
        } catch (err) { 
            showMessage('Failed to delete user.', 'error'); 
        } finally {
            setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
        }
    };

    // ==== Content Moderation Handlers ====

    /**
     * Handles the "Approve" button click. 
     * Opens a modal for instructor applications (to add a note), or approves courses/tests directly.
     */
    const handleApproveClick = (id) => {
        if (activeTab === 'applications') {
            setApproveModal({ isOpen: true, id });
            setApproveNote('');
        } else {
            executeAction(id, 'approve', '');
        }
    };

    const confirmApproveApp = async () => {
        setIsSubmitting(true);
        await executeAction(approveModal.id, 'approve', approveNote);
        setIsSubmitting(false);
        setApproveModal({ isOpen: false, id: null });
    };

    const openRejectModal = (id) => { setRejectModal({ isOpen: true, id }); setRejectNote(''); };
    const closeRejectModal = () => { setRejectModal({ isOpen: false, id: null }); setRejectNote(''); };

    /**
     * Confirms rejection and ensures an admin note is provided.
     */
    const confirmReject = async () => {
        // Enforce providing a reason for rejection
        if (!rejectNote.trim()) { 
            showMessage('Please provide a reason for rejection.', 'error'); 
            return; 
        }
        setIsSubmitting(true);
        await executeAction(rejectModal.id, 'reject', rejectNote);
        setIsSubmitting(false);
        closeRejectModal();
    };

    /**
     * Core function to execute moderation actions (Approve/Reject) across all content types.
     */
    const executeAction = async (id, actionType, note) => {
        try {
            if (activeTab === 'applications') {
                await api.patch(`/admin/instructors/applications/${id}/${actionType}`, { note });
            } else if (activeTab === 'courses') {
                const status = actionType === 'approve' ? 'published' : 'rejected';
                await api.patch(`/courses/admin/${id}/review`, { status, note });
            } else if (activeTab === 'tests') {
                const status = actionType === 'approve' ? 'published' : 'rejected';
                await api.patch(`/tests/admin/${id}/review`, { status, note });
            }
            showMessage(actionType === 'approve' ? 'Approved successfully.' : 'Rejected successfully.');
            loadData();
        } catch (error) { 
            showMessage('Action failed!', 'error'); 
        }
    };

    const getTitle = () => {
        switch(activeTab) {
            case 'users': return 'All Users';
            case 'applications': return 'Instructor Applications';
            case 'courses': return 'Courses Moderation';
            case 'tests': return 'Tests Moderation';
            default: return 'Admin Workspace';
        }
    };

    /**
     * Handles sending a system-wide broadcast notification to all active users.
     */
    const handleSendBroadcast = async () => {
        // Validate input data
        if (!broadcastModal.title.trim() || !broadcastModal.message.trim()) {
            showMessage('Please enter both a title and message for the broadcast.', 'error');
            return;
        }

        setIsBroadcasting(true);
        try {
            await api.post('/admin/broadcast', {
                title: broadcastModal.title,
                message: broadcastModal.message
            });
            showMessage('System broadcast sent successfully!');
            setBroadcastModal({ isOpen: false, title: '', message: '' }); // Close modal and reset state
        } catch (error) {
            console.error(error);
            showMessage('Failed to send broadcast. Please try again.', 'error');
        } finally {
            setIsBroadcasting(false);
        }
    };

    // ==== Dynamic Table Renderer ====
    const renderTableBody = () => {
        if (loading) return <tr><td colSpan="7" style={{textAlign:'center', padding: '20px'}}>Loading data...</td></tr>;
        if (dataList.length === 0) return <tr><td colSpan="7" style={{textAlign:'center', padding: '20px'}}>No records found.</td></tr>;

        if (activeTab === 'users') {
            return dataList.map(u => (
                <tr key={u._id}>
                    <td style={{ fontWeight: 'bold' }}>{u.fullname}</td>
                    <td>{u.email}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>
                        <select 
                            value={u.role}
                            onChange={(e) => handleRoleChangeRequest(u._id, e.target.value)}
                            style={{ 
                                padding: '6px', borderRadius: '6px', cursor: 'pointer',
                                border: '1px solid var(--border-color)', background: 'var(--bg-input)',
                                color: u.role === 'admin' ? 'var(--error)' : u.role === 'instructor' ? 'var(--primary)' : 'var(--text-main)',
                                fontWeight: 'bold', outline: 'none'
                            }}
                        >
                            <option value="student">Student</option>
                            <option value="instructor">Instructor</option>
                            <option value="admin">Admin</option>
                        </select>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                        {u.role === 'admin' ? (
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Admin</span>
                        ) : (
                            <button 
                                onClick={() => handleDeleteUserRequest(u._id, u.fullname, u.role)} 
                                style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '18px' }} 
                                title="Delete User"
                            >
                                <i className="bi bi-trash-fill"></i>
                            </button>
                        )}
                    </td>
                </tr>
            ));
        }

        if (activeTab === 'applications') {
            return dataList.map(a => (
                <tr key={a._id}>
                    <td>{a.fullName}</td><td>{a.email}</td><td>{a.phone}</td><td>{a.expertise}</td><td>{a.experience || 0}</td><td>{new Date(a.createdAt).toLocaleString()}</td>
                    <td>{subStatus === 'pending' ? (<div className="action-buttons"><button onClick={() => handleApproveClick(a._id)}>Approve</button><button onClick={() => openRejectModal(a._id)}>Reject</button></div>) : (<span className={`status-label ${a.status.toLowerCase()}`}>{a.status}</span>)}</td>
                </tr>
            ));
        }

        return dataList.map(item => (
            <tr key={item._id}>
                <td>
                    <strong>{item.title}</strong>
                    <div style={{ marginTop: '6px' }}>
                        <a 
                            href={activeTab === 'courses' ? `/instructor/courses/${item._id}/edit` : `/instructor/tests/${item._id}/edit`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold', background: 'var(--bg-input)', padding: '4px 8px', borderRadius: '6px' }}
                        >
                            <i className="bi bi-eye-fill"></i> Preview Detail
                        </a>
                    </div>
                </td>
                <td style={{textTransform:'capitalize'}}>{item.subject}</td><td>{item.grade}</td>
                <td>{item.createdBy?.fullname || 'Unknown'}<br/><small style={{color: 'var(--text-secondary)'}}>{item.createdBy?.email || ''}</small></td>
                <td>{item.numQuestions ? `${item.numQuestions} Qs` : `${item.sections?.length || 0} Sections`}</td><td>{new Date(item.updatedAt).toLocaleString()}</td>
                <td>{subStatus === 'pending' ? (<div className="action-buttons"><button onClick={() => handleApproveClick(item._id)}>Approve</button><button onClick={() => openRejectModal(item._id)}>Reject</button></div>) : (<span className={`status-label ${item.visibility.toLowerCase()}`}>{item.visibility}</span>)}</td>
            </tr>
        ));
    };

    return (
        <div className="admin-page-container">
            <SiteHeader />
            <div className="admin-page settings-wrap">
                <div className="admin-dashboard-wrapper">
                    
                    {/* ==== SIDEBAR ==== */}
                    <aside className="admin-sidebar">
                        <div className="sidebar-section">
                            <h4>People Management</h4>
                            <button className={`sidebar-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
                                <i className="bi bi-people-fill"></i> All Users
                            </button>
                            <button className={`sidebar-btn ${activeTab === 'applications' ? 'active' : ''}`} onClick={() => { setActiveTab('applications'); setSubStatus('pending'); }}>
                                <i className="bi bi-person-lines-fill"></i> Instructor Apps
                            </button>
                            <button className="sidebar-btn" onClick={() => setBroadcastModal({ isOpen: true, title: '', message: '' })}>
                                <i className="bi bi-megaphone-fill text-warning"></i> System Broadcast
                            </button>
                        </div>
                        <div className="sidebar-section">
                            <h4>Content</h4>
                            <button className={`sidebar-btn ${activeTab === 'courses' ? 'active' : ''}`} onClick={() => { setActiveTab('courses'); setSubStatus('pending'); }}>
                                <i className="bi bi-journal-album"></i> Courses
                            </button>
                            <button className={`sidebar-btn ${activeTab === 'tests' ? 'active' : ''}`} onClick={() => { setActiveTab('tests'); setSubStatus('pending'); }}>
                                <i className="bi bi-ui-checks-grid"></i> Tests
                            </button>
                        </div>
                    </aside>

                    {/* ==== MAIN CONTENT ==== */}
                    <div className="settings-card" style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2>
                                {activeTab === 'users' && <i className="bi bi-people-fill text-primary" style={{marginRight:'8px'}}></i>}
                                {getTitle()}
                            </h2>
                        </div>

                        {/* Search & Filter */}
                        {activeTab === 'users' ? (
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
                                <input 
                                    type="text" 
                                    placeholder="Search by name or email..." 
                                    value={userSearch} 
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', outline: 'none' }}
                                />
                                <select 
                                    value={userRoleFilter} 
                                    onChange={(e) => setUserRoleFilter(e.target.value)}
                                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-main)', outline: 'none' }}
                                >
                                    <option value="all">All Roles</option>
                                    <option value="student">Students</option>
                                    <option value="instructor">Instructors</option>
                                    <option value="admin">Admins</option>
                                </select>
                            </div>
                        ) : (
                            <div className="admin-sub-tabs">
                                <button className={subStatus === 'pending' ? 'active' : ''} onClick={() => setSubStatus('pending')}>Pending Review</button>
                                <button className={subStatus === 'approved' ? 'active' : ''} onClick={() => setSubStatus('approved')}>Approved / Published</button>
                                <button className={subStatus === 'rejected' ? 'active' : ''} onClick={() => setSubStatus('rejected')}>Rejected</button>
                            </div>
                        )}

                        {/* Toast */}
                        {msg.text && (
                            <div className="settings-msg" style={{ background: msg.type === 'error' ? 'var(--error)' : 'rgba(16, 185, 129, 0.1)', color: msg.type === 'error' ? '#fff' : 'var(--success)' }}>
                                {msg.text}
                            </div>
                        )}

                        <div className="results-table-wrap">
                            <table className="results-table">
                                <thead>
                                    {activeTab === 'users' ? (
                                        <tr><th>Name</th><th>Email</th><th>Joined Date</th><th>Role</th><th style={{ textAlign: 'center' }}>Actions</th></tr>
                                    ) : activeTab === 'applications' ? (
                                        <tr><th>Fullname</th><th>Email</th><th>Phone</th><th>Expertise</th><th>Exp</th><th>Applied Date</th><th>Action</th></tr>
                                    ) : (
                                        <tr><th>Title</th><th>Subject</th><th>Grade</th><th>Instructor</th><th>Content Size</th><th>Last Updated</th><th>Action</th></tr>
                                    )}
                                </thead>
                                <tbody>{renderTableBody()}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* ==== CUSTOM CONFIRM MODAL ==== */}
            {confirmModal.isOpen && (
                <div className="modal-overlay" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <i className={`bi ${confirmModal.isDanger ? 'bi-exclamation-triangle-fill' : 'bi-shield-lock-fill'}`} style={{ color: confirmModal.isDanger ? 'var(--error)' : '#eab308' }}></i>
                            <h3 style={{ color: 'var(--text-main)' }}>{confirmModal.title}</h3>
                        </div>
                        <div className="modal-body">
                            <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>{confirmModal.message}</p>
                        </div>
                        <div className="modal-actions">
                            <button className="modal-btn-cancel" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}>
                                Cancel
                            </button>
                            <button 
                                className="modal-btn-confirm" 
                                style={!confirmModal.isDanger ? { background: '#eab308', boxShadow: '0 4px 12px rgba(234, 179, 8, 0.2)' } : {}}
                                onClick={confirmModal.onConfirm}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* ==== REJECT MODAL ==== */}
            {rejectModal.isOpen && (
                <div className="modal-overlay" onClick={closeRejectModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <i className="bi bi-exclamation-triangle-fill"></i>
                            <h3>Reject Submission</h3>
                        </div>
                        <div className="modal-body">
                            <p>Please provide constructive feedback so the instructor knows what to fix before re-submitting.</p>
                            <textarea 
                                placeholder="E.g., The quality of the math formulas in lesson 2 is hard to read..." 
                                value={rejectNote} 
                                onChange={(e) => setRejectNote(e.target.value)} 
                                autoFocus 
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="modal-btn-cancel" onClick={closeRejectModal} disabled={isSubmitting}>Cancel</button>
                            <button className="modal-btn-confirm" onClick={confirmReject} disabled={isSubmitting}>
                                {isSubmitting ? 'Rejecting...' : 'Submit Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==== APPROVE MODAL ==== */}
            {approveModal.isOpen && (
                <div className="modal-overlay" onClick={() => setApproveModal({ isOpen: false, id: null })}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <i className="bi bi-check-circle-fill" style={{ color: 'var(--success)' }}></i>
                            <h3>Approve Application</h3>
                        </div>
                        <div className="modal-body">
                            <p>You can optionally leave a welcome note for the new instructor:</p>
                            <textarea 
                                placeholder="Welcome to the team!..." 
                                value={approveNote} 
                                onChange={(e) => setApproveNote(e.target.value)} 
                                autoFocus 
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="modal-btn-cancel" onClick={() => setApproveModal({ isOpen: false, id: null })} disabled={isSubmitting}>Cancel</button>
                            <button 
                                className="modal-btn-confirm" 
                                style={{ background: 'var(--success)', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
                                onClick={confirmApproveApp} 
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? 'Approving...' : 'Approve Application'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==== SYSTEM BROADCAST MODAL ==== */}
            {broadcastModal.isOpen && (
                <div className="modal-overlay" onClick={() => setBroadcastModal({ ...broadcastModal, isOpen: false })}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <i className="bi bi-megaphone-fill text-warning"></i>
                            <h3>System Broadcast</h3>
                        </div>
                        <div className="modal-body">
                            <p style={{ marginBottom: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                                This notification will instantly appear as a popup (toast) for <strong>all online users</strong>.
                            </p>
                            
                            <input 
                                type="text" 
                                placeholder="Title (e.g., Scheduled Maintenance)" 
                                value={broadcastModal.title} 
                                onChange={(e) => setBroadcastModal({ ...broadcastModal, title: e.target.value })} 
                                style={{ 
                                    width: '100%', padding: '10px', marginBottom: '12px', 
                                    borderRadius: '6px', border: '1px solid var(--border-color)', 
                                    background: 'var(--bg-input)', color: 'var(--text-main)' 
                                }}
                                autoFocus 
                            />
                            
                            <textarea 
                                placeholder="Broadcast message (e.g., The system will undergo maintenance at 00:00...)" 
                                value={broadcastModal.message} 
                                onChange={(e) => setBroadcastModal({ ...broadcastModal, message: e.target.value })} 
                                rows="4"
                            />
                        </div>
                        <div className="modal-actions">
                            <button 
                                className="modal-btn-cancel" 
                                onClick={() => setBroadcastModal({ ...broadcastModal, isOpen: false })} 
                                disabled={isBroadcasting}
                            >
                                Cancel
                            </button>
                            <button 
                                className="modal-btn-confirm" 
                                style={{ background: '#eab308', boxShadow: '0 4px 12px rgba(234, 179, 8, 0.2)' }}
                                onClick={handleSendBroadcast} 
                                disabled={isBroadcasting}
                            >
                                {isBroadcasting ? 'Broadcasting...' : 'Broadcast Now'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <SiteFooter />
        </div>
    );
}