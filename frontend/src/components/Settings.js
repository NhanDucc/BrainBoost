import { useState, useEffect } from 'react';
import { api } from '../api';
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { useUser } from '../context/UserContext';
import '../css/Settings.css';

/**
 * Settings Component
 * Allows users to manage their account security, display preferences, notifications, and privacy settings.
 * Includes real-time theme preview and connects to the global UserContext.
 */
export default function Settings() {
    // Active tab state to handle navigation within the settings page
    const [activeTab, setActiveTab] = useState('account');
    
    // Global user context to fetch and refresh user data
    const { user, fetchMe } = useUser();

    // ==== Alert States ====

    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // ==== Form & UI States ====

    // State to handle password changes
    const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });

    // State to toggle the custom account deletion confirmation modal
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // State for user preferences (UI settings, notifications, privacy)
    const [preferences, setPreferences] = useState({
        theme: 'light',
        language: 'en',
        notifyEmail: true,
        notifyAIGrading: true,
        notifyLeaderboard: false,
        hideOnLeaderboard: false,
    });

    // ==== Lifecycle Hooks (Effects) ====

    /**
     * Sync local preference state with global user data when the component mounts or user data updates.
     * Also applies the saved theme globally upon loading.
     */
    useEffect(() => {
        if (user && user.preferences) {
            setPreferences(prev => ({ ...prev, ...user.preferences }));
            // Apply the theme to the entire website document immediately
            document.documentElement.setAttribute('data-theme', user.preferences.theme || 'light');
        }
    }, [user]);

    /**
     * Real-time theme preview: updates the document's theme attribute immediately 
     * when the user selects a new theme from the dropdown, before even saving.
     */
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', preferences.theme);
    }, [preferences.theme]);

    // Utility function to clear all alert messages.
    const clearAlerts = () => { setMsg(''); setSuccess(''); setError(''); };

    // Auto-hide alert messages after 4 seconds to keep the UI clean.
    useEffect(() => {
        if (!msg && !success && !error) return;
        const timer = setTimeout(() => clearAlerts(), 4000);
        return () => clearTimeout(timer);
    }, [msg, success, error]);

    // ==== Event Handlers ====

    /**
     * Password Update Logic
     * Validates and submits the new password to the server.
     */
    const savePassword = async (e) => {
        e.preventDefault();
        clearAlerts();
        
        if (pwd.newPassword !== pwd.confirm) {
            setError('New password and confirm do not match.');
            return;
        }
        
        try {
            setMsg('Updating password...');
            await api.put(`users/me/password`, { 
                currentPassword: pwd.currentPassword, 
                newPassword: pwd.newPassword 
            });
            
            setMsg('');
            setSuccess('Password updated successfully!');
            setPwd({ currentPassword: '', newPassword: '', confirm: '' }); // Reset form
        } catch (e) {
            setMsg('');
            setError(e.response?.data?.message || 'Update password failed');
        }
    };

    /**
     * Preferences Update Logic
     * Handles changes for both standard inputs and checkbox toggles.
     */
    const handlePrefChange = (e) => {
        const { name, value, type, checked } = e.target;
        setPreferences(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // Submits the updated display and notification preferences to the backend.    
    const savePreferences = async (e) => {
        e.preventDefault();
        clearAlerts();
        try {
            setMsg('Saving preferences...');
            await api.put('/users/me/preferences', {
                theme: preferences.theme,
                language: preferences.language,
                notifyEmail: preferences.notifyEmail,
                notifyAIGrading: preferences.notifyAIGrading,
                notifyLeaderboard: preferences.notifyLeaderboard
            });
            await fetchMe(); // Refresh the UserContext to reflect changes globally
            
            setMsg('');
            setSuccess('Settings saved successfully!');
        } catch (err) {
            setMsg('');
            setError(err.response?.data?.message || 'Failed to save settings');
        }
    };

    /**
     * Account Deletion Logic (via Custom Modal)
     * Placeholder function for the account deletion process.
     */
    const handleConfirmDelete = () => {
        setShowDeleteModal(false);
        alert("Feature coming soon: Contact admin to delete your account.");
        // Future implementation: await api.delete('/users/me')
    };

    /**
     * Privacy Settings Logic
     * Specifically handles updating leaderboard anonymity.
     */
    const savePrivacy = async (e) => {
        e.preventDefault();
        clearAlerts();
        try {
            setMsg('Saving privacy settings...');
            
            // Call API to update the anonymous flag
            await api.put('/users/me/preferences', { 
                isAnonymous: preferences.hideOnLeaderboard 
            });
            
            // Refresh UserContext so components like Header and Leaderboard receive the updated data
            await fetchMe(); 
            
            setMsg('');
            setSuccess('Privacy settings saved successfully!');
        } catch (err) {
            setMsg('');
            setError(err.response?.data?.message || 'Failed to save privacy settings');
        }
    };

    return (
        <div className="settings-page">
        <SiteHeader />
        
        <div className="set-container">
            <div className="set-header">
            <h1 className="set-title">Settings</h1>
            <p className="set-subtitle">Manage your account preferences and system settings.</p>
            </div>

            <div className="set-layout">
            {/* Sidebar Navigation */}
            <aside className="set-sidebar">
                <button className={`set-nav-item ${activeTab === 'account' ? 'active' : ''}`} onClick={() => setActiveTab('account')}>
                <i className="bi bi-shield-lock"></i> Account & Security
                </button>
                <button className={`set-nav-item ${activeTab === 'display' ? 'active' : ''}`} onClick={() => setActiveTab('display')}>
                <i className="bi bi-display"></i> Display Preferences
                </button>
                <button className={`set-nav-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
                <i className="bi bi-bell"></i> Notifications
                </button>
                <button className={`set-nav-item ${activeTab === 'privacy' ? 'active' : ''}`} onClick={() => setActiveTab('privacy')}>
                <i className="bi bi-eye-slash"></i> Privacy
                </button>
            </aside>

            {/* Main Content Area */}
            <main className="set-content">
                
                {/* Global Status Alerts */}
                {msg && <div className="set-alert info">{msg}</div>}
                {success && <div className="set-alert success">{success}</div>}
                {error && <div className="set-alert error">{error}</div>}

                {/* Tab 1: Account & Security */}
                {activeTab === 'account' && (
                <div className="set-section animate-fade">
                    <h2>Account & Security</h2>
                    <p className="set-desc">Update your password and manage account security.</p>
                    
                    <div className="set-card">
                        <h3>Change Password</h3>
                        <form onSubmit={savePassword}>
                            <div className="form-group">
                                <label>Current Password</label>
                                <input type="password" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>New Password</label>
                                <input type="password" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} required minLength={6} />
                            </div>
                            <div className="form-group">
                                <label>Confirm New Password</label>
                                <input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} required />
                            </div>
                            <button className="primary-btn" type="submit">Update Password</button>
                        </form>
                    </div>

                    <div className="set-card danger-zone">
                        <h3>Danger Zone</h3>
                        <p>Once you delete your account, there is no going back. Please be certain.</p>
                        <button className="danger-btn" onClick={() => setShowDeleteModal(true)}>Delete Account</button>
                    </div>
                </div>
                )}

                {/* Tab 2: Display Preferences */}
                {activeTab === 'display' && (
                <div className="set-section animate-fade">
                    <h2>Display Preferences</h2>
                    <p className="set-desc">Customize how BrainBoost looks and feels.</p>
                    
                    <form className="set-card" onSubmit={savePreferences}>
                        <div className="form-group">
                            <label>Theme</label>
                            <select name="theme" value={preferences.theme} onChange={handlePrefChange}>
                                <option value="light">Light Mode (Default)</option>
                                <option value="dark">Dark Mode</option>
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label>Language</label>
                            <select name="language" value={preferences.language} onChange={handlePrefChange}>
                                <option value="en">English (Default)</option>
                                <option value="vi">Tiếng Việt</option>
                            </select>
                        </div>

                        <button className="primary-btn" type="submit">Save Preferences</button>
                    </form>
                </div>
                )}

                {/* Tab 3: Notifications */}
                {activeTab === 'notifications' && (
                <div className="set-section animate-fade">
                    <h2>Notifications</h2>
                    <p className="set-desc">Choose what updates you want to receive.</p>

                    <form className="set-card" onSubmit={savePreferences}>
                        <div className="toggle-row">
                            <div className="toggle-info">
                                <strong>Study Reminders</strong>
                                <span>Get an email if you haven't studied for 3 days.</span>
                            </div>
                            <label className="switch">
                                <input type="checkbox" name="notifyEmail" checked={preferences.notifyEmail} onChange={handlePrefChange} />
                                <span className="slider round"></span>
                            </label>
                        </div>

                        <div className="toggle-row">
                            <div className="toggle-info">
                                <strong>AI Grading Alerts</strong>
                                <span>Notify me when AI finishes grading my essay questions.</span>
                            </div>
                            <label className="switch">
                                <input type="checkbox" name="notifyAIGrading" checked={preferences.notifyAIGrading} onChange={handlePrefChange} />
                                <span className="slider round"></span>
                            </label>
                        </div>

                        <div className="toggle-row">
                            <div className="toggle-info">
                                <strong>Leaderboard Updates</strong>
                                <span>Alert me when someone beats my high score.</span>
                            </div>
                            <label className="switch">
                                <input type="checkbox" name="notifyLeaderboard" checked={preferences.notifyLeaderboard} onChange={handlePrefChange} />
                                <span className="slider round"></span>
                            </label>
                        </div>

                        <button className="primary-btn mt-3" type="submit">Save Notifications</button>
                    </form>
                </div>
                )}

                {/* Tab 4: Privacy Settings */}
                {activeTab === 'privacy' && (
                <div className="set-section animate-fade">
                    <h2>Privacy Settings</h2>
                    <p className="set-desc">Control your data and visibility on the platform.</p>

                    <form className="set-card" onSubmit={savePrivacy}>
                        <div className="toggle-row">
                            <div className="toggle-info">
                                <strong>Anonymous on Leaderboard</strong>
                                <span>Hide my real name and avatar on public test rankings.</span>
                            </div>
                            <label className="switch">
                                <input 
                                    type="checkbox" 
                                    name="hideOnLeaderboard" 
                                    checked={preferences.hideOnLeaderboard} 
                                    onChange={handlePrefChange} 
                                />
                                <span className="slider round"></span>
                            </label>
                        </div>

                        <hr style={{ margin: '20px 0', borderColor: 'var(--border-color)' }} />

                        <div className="privacy-links">
                            <p>Read our policies to understand how we protect your data:</p>
                            <ul>
                                <li><a href="/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy <i className="bi bi-box-arrow-up-right"></i></a></li>
                                <li><a href="/terms-of-use" target="_blank" rel="noreferrer">Terms of Use <i className="bi bi-box-arrow-up-right"></i></a></li>
                            </ul>
                        </div>

                        <button className="primary-btn mt-3" type="submit">Save Privacy Settings</button>
                    </form>
                </div>
                )}

            </main>
            </div>
        </div>
        <SiteFooter />

        {/* ==== Custom Delete Confirmation Modal ==== */}
        {showDeleteModal && (
            <div className="settings-modal-backdrop" onClick={() => setShowDeleteModal(false)}>
                <div className="settings-modal-card" onClick={(e) => e.stopPropagation()}>
                    <div className="sm-icon">
                        <i className="bi bi-exclamation-triangle-fill"></i>
                    </div>
                    <h3 className="sm-title">Delete Account</h3>
                    <p className="sm-desc">
                    Are you sure you want to delete your account? This action <strong>CANNOT</strong> be undone and all your learning progress will be permanently lost.
                    </p>
                    <div className="sm-actions">
                        <button className="sm-btn-cancel" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                        <button className="sm-btn-danger" onClick={handleConfirmDelete}>Yes, Delete My Account</button>
                    </div>
                </div>
            </div>
        )}
        </div>
    );
}