import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { api } from '../api';
import '../css/Admin.css';

/**
 * AdminUsers Component
 * Provides a dashboard interface for administrators to manage all users on the platform.
 * Features include searching, filtering by role, updating roles, and deleting accounts.
 */
export default function AdminUsers() {
    const navigate = useNavigate();
    
    // ---- State Management ----
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // States for Search and Filtering
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    
    // State for displaying success/error notification messages
    const [msg, setMsg] = useState({ text: '', type: '' });

    /**
     * Fetches the list of users from the backend based on current filters.
     */
    const fetchUsers = async () => {
        setLoading(true);
        try {
            // Append search and role filters as query parameters
            const res = await api.get(`/admin/users?role=${roleFilter}&search=${search}`);
            setUsers(res.data || []);
        } catch (err) {
            showMessage('Failed to fetch users', 'error');
        } finally {
            setLoading(false);
        }
    };

    /**
     * Automatically fetch users when the component mounts or when filters change.
     * Uses a "debounce" technique to delay the API call by 300ms after the user stops typing,
     * reducing unnecessary requests to the server.
     */
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchUsers();
        }, 300); 
        
        // Cleanup function to clear the timeout if inputs change before 300ms
        return () => clearTimeout(delayDebounceFn);
        // eslint-disable-next-line
    }, [search, roleFilter]);

    /**
     * Helper function to display a temporary notification message.
     * @param {string} text - The message to display.
     * @param {string} type - 'success' or 'error' (determines background color).
     */
    const showMessage = (text, type = 'success') => {
        setMsg({ text, type });
        // Auto-hide the message after 3 seconds
        setTimeout(() => setMsg({ text: '', type: '' }), 3000);
    };

    /**
     * Handles changing a user's role directly from the dropdown.
     * @param {string} userId - The ID of the user being modified.
     * @param {string} newRole - The newly selected role.
     */
    const handleRoleChange = async (userId, newRole) => {
        try {
            await api.patch(`/admin/users/${userId}/role`, { role: newRole });
            showMessage('User role updated successfully');
            
            // Instantly update the local UI state to reflect the change without reloading the page
            setUsers(users.map(u => u._id === userId ? { ...u, role: newRole } : u));
        } catch (err) {
            showMessage(err.response?.data?.message || 'Failed to update role', 'error');
        }
    };

    /**
     * Prompts for confirmation and deletes a user account.
     * @param {string} userId - The ID of the user to delete.
     * @param {string} fullname - The name of the user (used in the confirmation prompt).
     */
    const handleDelete = async (userId, fullname) => {
        // Prevent accidental deletions
        if (!window.confirm(`Are you sure you want to completely delete the user: ${fullname}? This action cannot be undone.`)) return;
        
        try {
            await api.delete(`/admin/users/${userId}`);
            showMessage('User deleted successfully');
            
            // Remove the deleted user from the local UI state
            setUsers(users.filter(u => u._id !== userId));
        } catch (err) {
            showMessage(err.response?.data?.message || 'Failed to delete user', 'error');
        }
    };

    // ==== Render ====

    return (
        <div className="admin-page-container">
            <SiteHeader />
            <div className="settings-wrap admin-page">
                <div className="settings-card" style={{ maxWidth: '1000px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2><i className="bi bi-people-fill text-primary"></i> User Management</h2>
                        <button className="ghost-btn" onClick={() => navigate('/profile')}>Back to Profile</button>
                    </div>

                    {/* ==== Search & Filter Toolbar ==== */}
                    <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
                        <input 
                            type="text" 
                            placeholder="Search by name or email..." 
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-input)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
                        />
                        <select 
                            value={roleFilter} 
                            onChange={(e) => setRoleFilter(e.target.value)}
                            style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-input)', background: 'var(--bg-input)', color: 'var(--text-main)' }}
                        >
                            <option value="all">All Roles</option>
                            <option value="student">Students</option>
                            <option value="instructor">Instructors</option>
                            <option value="admin">Admins</option>
                        </select>
                    </div>

                    {/* ==== Notification Message ==== */}
                    {msg.text && (
                        <div className="settings-msg" style={{ background: msg.type === 'error' ? 'var(--error)' : 'var(--success)', color: '#fff' }}>
                            {msg.text}
                        </div>
                    )}

                    {/* ==== Users Data Table ==== */}
                    <div className="results-table-wrap">
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading users...</div>
                        ) : (
                            <table className="results-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Joined Date</th>
                                        <th>Role</th>
                                        <th style={{ textAlign: 'center' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u._id}>
                                            <td style={{ fontWeight: 'bold' }}>{u.fullname}</td>
                                            <td>{u.email}</td>
                                            <td style={{ color: 'var(--text-secondary)' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                                            <td>
                                                {/* Role Dropdown Selector */}
                                                <select 
                                                    value={u.role}
                                                    onChange={(e) => handleRoleChange(u._id, e.target.value)}
                                                    style={{ 
                                                        padding: '6px', borderRadius: '6px', cursor: 'pointer',
                                                        border: '1px solid var(--border-color)', background: 'var(--bg-object)',
                                                        color: u.role === 'admin' ? 'var(--error)' : u.role === 'instructor' ? 'var(--primary)' : 'var(--text-main)',
                                                        fontWeight: 'bold'
                                                    }}
                                                >
                                                    <option value="student">Student</option>
                                                    <option value="instructor">Instructor</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {/* Delete User Button */}
                                                <button 
                                                    onClick={() => handleDelete(u._id, u.fullname)}
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '18px' }}
                                                    title="Delete User"
                                                >
                                                    <i className="bi bi-trash-fill"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Empty State Fallback */}
                                    {!users.length && <tr><td colSpan="5" style={{textAlign:'center'}}>No users found matching your criteria.</td></tr>}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
            <SiteFooter />
        </div>
    );
}