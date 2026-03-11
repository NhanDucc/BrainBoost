import React, { useEffect, useState } from 'react';
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { api } from '../api';
import '../css/Admin.css';

/**
 * AdminDashboard Component
 * Acts as the central moderation hub for the platform.
 * Allows administrators to review, approve, or reject Instructor Applications, Courses, and Tests.
 */
export default function AdminDashboard() {
    // ==== Navigation & Filter States ====
    const [mainTab, setMainTab] = useState('courses');     // Tracks the active category: 'applications', 'courses', or 'tests'
    const [subStatus, setSubStatus] = useState('pending'); // Tracks the current filter: 'pending', 'approved', or 'rejected'
    
    // ==== Data & UI States ====
    const [dataList, setDataList] = useState([]);          // Holds the fetched array of items to display in the table
    const [msg, setMsg] = useState('');                    // Manages temporary success/error toast messages

    // ==== Reject Modal States ====
    const [rejectModal, setRejectModal] = useState({ isOpen: false, id: null }); // Controls modal visibility and target item ID
    const [rejectNote, setRejectNote] = useState('');                            // Stores the admin's feedback/reason for rejection
    const [isSubmitting, setIsSubmitting] = useState(false);                     // Prevents double-clicking during API calls

    // ==== Data Fetching ====

    /**
     * Fetches data from the backend based on the currently selected mainTab and subStatus.
     */
    const loadData = async () => {
        try {
            let res;
            // Route the API request based on the selected main category
            if (mainTab === 'applications') {
                const statusQuery = subStatus === 'approved' ? 'approved' : subStatus;
                res = await api.get(`/admin/instructors/applications?status=${statusQuery}`);
            } else if (mainTab === 'courses') {
                const statusQuery = subStatus === 'approved' ? 'published' : subStatus;
                res = await api.get(`/courses/admin/list?status=${statusQuery}`);
            } else if (mainTab === 'tests') {
                const statusQuery = subStatus === 'approved' ? 'published' : subStatus;
                res = await api.get(`/tests/admin/list?status=${statusQuery}`);
            }
            setDataList(res?.data || []);
        } catch (error) {
            console.error("Failed to load data:", error);
        }
    };

    // Re-fetch data whenever the user switches tabs or status filters
    useEffect(() => { 
        loadData(); 
        /* eslint-disable-next-line */ 
    }, [mainTab, subStatus]);

    // ==== Action Handlers (Approve/Reject) ====

    /**
     * Handles the quick-approval workflow.
     * @param {String} id - The ID of the item being approved.
     */
    const handleApprove = async (id) => {
        let note = '';
        // Optional: Allow admins to leave a welcome note for new instructor applications
        if (mainTab === 'applications') {
            note = prompt('Note to applicant (optional):') || '';
        }
        await executeAction(id, 'approve', note);
    };

    /**
     * Opens the Rejection Modal and attaches the target item's ID.
     */
    const openRejectModal = (id) => {
        setRejectModal({ isOpen: true, id });
        setRejectNote(''); // Reset the textarea to ensure no leftover text from previous actions
    };

    /**
     * Closes the Rejection Modal and clears state.
     */
    const closeRejectModal = () => {
        setRejectModal({ isOpen: false, id: null });
        setRejectNote('');
    };

    /**
     * Validates the rejection feedback and triggers the API call.
     */
    const confirmReject = async () => {
        if (!rejectNote.trim()) {
            alert('Please enter the feedback reason for rejection.');
            return;
        }
        setIsSubmitting(true);
        await executeAction(rejectModal.id, 'reject', rejectNote);
        setIsSubmitting(false);
        closeRejectModal(); // Close modal on success
    };

    /**
     * Core function to execute the API call for both Approve and Reject actions.
     * Routes the PATCH request to the correct endpoint based on the active tab.
     */
    const executeAction = async (id, actionType, note) => {
        try {
            if (mainTab === 'applications') {
                await api.patch(`/admin/instructors/applications/${id}/${actionType}`, { note });
            } else if (mainTab === 'courses') {
                // Map the action to the exact schema status string ('published' or 'rejected')
                const status = actionType === 'approve' ? 'published' : 'rejected';
                await api.patch(`/courses/admin/${id}/review`, { status, note });
            } else if (mainTab === 'tests') {
                const status = actionType === 'approve' ? 'published' : 'rejected';
                await api.patch(`/tests/admin/${id}/review`, { status, note });
            }

            // Display success message and refresh the table data
            setMsg(actionType === 'approve' ? 'Approved successfully.' : 'Rejected successfully.');
            loadData();
            
            // Auto-hide the message after 3 seconds
            setTimeout(() => setMsg(''), 3000);
        } catch (error) {
            alert('Action failed! Please try again.');
        }
    };

    // ==== Dynamic UI Rendering ====

    /**
     * Dynamically generates table rows depending on whether the admin is viewing
     * Instructor Applications or Educational Content (Courses/Tests).
     */
    const renderTableBody = () => {
        // Fallback UI when no records exist
        if (dataList.length === 0) {
            return <tr><td colSpan="7" style={{textAlign:'center', padding: '20px'}}>No {mainTab} found.</td></tr>;
        }

        // Render UI specifically for Instructor Applications
        if (mainTab === 'applications') {
            return dataList.map(a => (
                <tr key={a._id}>
                    <td>{a.fullName}</td>
                    <td>{a.email}</td>
                    <td>{a.phone}</td>
                    <td>{a.expertise}</td>
                    <td>{a.experience || 0}</td>
                    <td>{new Date(a.createdAt).toLocaleString()}</td>
                    <td>
                        {subStatus === 'pending' ? (
                            <div className="action-buttons">
                                <button onClick={() => handleApprove(a._id)}>Approve</button>
                                <button onClick={() => openRejectModal(a._id)}>Reject</button>
                            </div>
                        ) : (
                            <span className={`status-label ${a.status.toLowerCase()}`}>
                                {a.status}
                            </span>
                        )}
                    </td>
                </tr>
            ));
        }

        // Render shared UI structure for Courses and Tests
        return dataList.map(item => (
            <tr key={item._id}>
                <td>
                    <strong>{item.title}</strong>
                    
                    {/* Preview Button: Opens the content in a new tab so admins don't lose their place in the dashboard */}
                    <div style={{ marginTop: '6px' }}>
                        <a 
                            href={mainTab === 'courses' ? `/courses/${item._id}` : `/tests/${item._id}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ 
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                fontSize: '0.85rem', color: 'var(--primary)', 
                                textDecoration: 'none', fontWeight: 'bold',
                                background: 'var(--bg-input)', padding: '4px 8px',
                                borderRadius: '6px'
                            }}
                        >
                            <i className="bi bi-eye-fill"></i> Preview
                        </a>
                    </div>
                </td>
                <td style={{textTransform:'capitalize'}}>{item.subject}</td>
                <td>{item.grade}</td>
                <td>
                    {item.createdBy?.fullname || 'Unknown'}<br/>
                    <small style={{color: 'var(--text-secondary)'}}>{item.createdBy?.email || ''}</small>
                </td>
                {/* Dynamically show either Question count (for Tests) or Section count (for Courses) */}
                <td>{item.numQuestions ? `${item.numQuestions} Qs` : `${item.sections?.length || 0} Sections`}</td>
                <td>{new Date(item.updatedAt).toLocaleString()}</td>
                <td>
                    {/* Render action buttons if viewing pending items, otherwise just show the current status badge */}
                    {subStatus === 'pending' ? (
                        <div className="action-buttons">
                            <button onClick={() => handleApprove(item._id)}>Approve</button>
                            <button onClick={() => openRejectModal(item._id)}>Reject</button> 
                        </div>
                    ) : (
                        <span className={`status-label ${item.visibility.toLowerCase()}`}>
                            {item.visibility}
                        </span>
                    )}
                </td>
            </tr>
        ));
    };

    // ==== Render ====

    return (
        <div className="admin-page-container">
            <SiteHeader />
            <div className="settings-wrap admin-page">
                <div className="settings-card">
                    <h2>Admin Dashboard</h2>
                    
                    {/* ---- Main Tabs (Category Selection) ---- */}
                    <div className="admin-main-tabs">
                        <button 
                            className={`main-tab ${mainTab === 'courses' ? 'active' : ''}`}
                            onClick={() => { setMainTab('courses'); setSubStatus('pending'); }}
                        >
                            Courses Moderation
                        </button>
                        <button 
                            className={`main-tab ${mainTab === 'tests' ? 'active' : ''}`}
                            onClick={() => { setMainTab('tests'); setSubStatus('pending'); }}
                        >
                            Tests Moderation
                        </button>
                        <button 
                            className={`main-tab ${mainTab === 'applications' ? 'active' : ''}`}
                            onClick={() => { setMainTab('applications'); setSubStatus('pending'); }}
                        >
                            Instructor Applications
                        </button>
                    </div>

                    {/* ---- Sub Tabs (Status Filtering) ---- */}
                    <div className="admin-sub-tabs">
                        <button className={subStatus === 'pending' ? 'active' : ''} onClick={() => setSubStatus('pending')}>
                            Pending Review
                        </button>
                        <button className={subStatus === 'approved' ? 'active' : ''} onClick={() => setSubStatus('approved')}>
                            Approved / Published
                        </button>
                        <button className={subStatus === 'rejected' ? 'active' : ''} onClick={() => setSubStatus('rejected')}>
                            Rejected
                        </button>
                    </div>

                    {/* Success/Error Feedback Message */}
                    {msg && <div className="settings-msg">{msg}</div>}

                    {/* ---- Data Table ---- */}
                    <div className="results-table-wrap">
                        <table className="results-table">
                            <thead>
                                {mainTab === 'applications' ? (
                                    <tr>
                                        <th>Fullname</th><th>Email</th><th>Phone</th><th>Expertise</th><th>Exp</th><th>Applied Date</th><th>Action</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th>Title</th><th>Subject</th><th>Grade</th><th>Instructor</th><th>Content Size</th><th>Last Updated</th><th>Action</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody>
                                {renderTableBody()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            {/* ==== Reject Modal Overlay ==== */}
            {rejectModal.isOpen && (
                <div className="modal-overlay" onClick={closeRejectModal}>
                    {/* Stop propagation ensures clicking inside the modal doesn't trigger the overlay's onClick */}
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
                            <button 
                                className="modal-btn-cancel" 
                                onClick={closeRejectModal}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button 
                                className="modal-btn-confirm" 
                                onClick={confirmReject}
                                // Disable button if submitting OR if the feedback textarea is empty
                                disabled={isSubmitting || !rejectNote.trim()}
                            >
                                {isSubmitting ? 'Rejecting...' : 'Submit Rejection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <SiteFooter />
        </div>
    );
}