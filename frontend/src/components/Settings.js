import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { useUser } from '../context/UserContext';
import '../css/Settings.css';

export default function Settings() {
    const [activeTab, setActiveTab] = useState('account');
    const { user, fetchMe } = useUser();
    const navigate = useNavigate();

    // Alert States
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Password State
    const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });

    // Modal State cho việc Xóa tài khoản
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // Mock states cho các chức năng UI mới 
    const [preferences, setPreferences] = useState({
        theme: 'light',
        language: 'en',
        notifyEmail: true,
        notifyAIGrading: true,
        notifyLeaderboard: false,
        hideOnLeaderboard: false,
    });

    // Đồng bộ state UI với dữ liệu User từ Context khi component mount
    useEffect(() => {
        if (user) {
            setPreferences(prev => ({
                ...prev,
                hideOnLeaderboard: user.preferences?.isAnonymous || false
            }));
        }
    }, [user]);

    const clearAlerts = () => { setMsg(''); setSuccess(''); setError(''); };

    useEffect(() => {
        if (!msg && !success && !error) return;
        const timer = setTimeout(() => clearAlerts(), 4000);
        return () => clearTimeout(timer);
    }, [msg, success, error]);

    // 1. Logic Đổi Mật Khẩu
    const savePassword = async (e) => {
        e.preventDefault();
        clearAlerts();
        if (pwd.newPassword !== pwd.confirm) {
        setError('New password and confirm do not match.');
        return;
        }
        try {
        setMsg('Updating password...');
        await api.put(`users/me/password`, { currentPassword: pwd.currentPassword, newPassword: pwd.newPassword });
        setMsg('');
        setSuccess('Password updated successfully!');
        setPwd({ currentPassword: '', newPassword: '', confirm: '' });
        } catch (e) {
        setMsg('');
        setError(e.response?.data?.message || 'Update password failed');
        }
    };

    // 2. Logic Lưu các thiết lập
    const handlePrefChange = (e) => {
        const { name, value, type, checked } = e.target;
        setPreferences(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
        }));
    };

    const savePreferences = (e) => {
        e.preventDefault();
        setSuccess('Settings saved successfully!');
    };

    // 3. Logic Xử lý Xóa Tài Khoản (bằng Modal mới)
    const handleConfirmDelete = () => {
        setShowDeleteModal(false);
        alert("Feature coming soon: Contact admin to delete your account.");
        // Sau này bạn có thể gọi API xóa tài khoản ở đây: await api.delete('/users/me')
    };

    const savePrivacy = async (e) => {
        e.preventDefault();
        clearAlerts();
        try {
            setMsg('Saving privacy settings...');
            // Gọi API cập nhật preferences
            await api.put('/users/me/preferences', { 
                isAnonymous: preferences.hideOnLeaderboard 
            });
            
            // Refresh lại Context để Header và các component khác nhận data mới
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
            {/* SIDEBAR */}
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

            {/* MAIN CONTENT */}
            <main className="set-content">
                
                {msg && <div className="set-alert info">{msg}</div>}
                {success && <div className="set-alert success">{success}</div>}
                {error && <div className="set-alert error">{error}</div>}

                {/* TAB 1: ACCOUNT & SECURITY */}
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
                    {/* Nút này giờ sẽ mở Custom Modal thay vì window.confirm */}
                    <button className="danger-btn" onClick={() => setShowDeleteModal(true)}>Delete Account</button>
                    </div>
                </div>
                )}

                {/* TAB 2: DISPLAY PREFERENCES */}
                {activeTab === 'display' && (
                <div className="set-section animate-fade">
                    <h2>Display Preferences</h2>
                    <p className="set-desc">Customize how BrainBoost looks and feels.</p>
                    
                    <form className="set-card" onSubmit={savePreferences}>
                    <div className="form-group">
                        <label>Theme</label>
                        <select name="theme" value={preferences.theme} onChange={handlePrefChange}>
                        <option value="light">☀️ Light Mode (Default)</option>
                        <option value="dark">🌙 Dark Mode (Coming soon)</option>
                        </select>
                    </div>
                    
                    <div className="form-group">
                        <label>Language</label>
                        <select name="language" value={preferences.language} onChange={handlePrefChange}>
                        <option value="en">English</option>
                        <option value="vi">Tiếng Việt</option>
                        </select>
                    </div>

                    <button className="primary-btn" type="submit">Save Preferences</button>
                    </form>
                </div>
                )}

                {/* TAB 3: NOTIFICATIONS */}
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

                {/* TAB 4: PRIVACY */}
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

                        <hr style={{ margin: '20px 0', borderColor: '#e2e8f0' }} />

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

        {/* ==========================================
            CUSTOM DELETE CONFIRMATION MODAL
            ========================================== */}
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