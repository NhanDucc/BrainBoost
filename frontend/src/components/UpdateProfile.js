import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import '../css/UpdateProfile.css';
import { useUser } from '../context/UserContext';

export default function Settings() {
  const { fetchMe, setUser } = useUser();
  const [tab, setTab] = useState('basic');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const clearAlerts = () => { setMsg(''); setSuccess(''); setError(''); };

  // Basic info
  const [form, setForm] = useState({
    fullname: '',
    email: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    bio: '',
  });

  // Change password
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await api.get('/users/me');
        const u = res.data || {};
        setForm({
          fullname: u.fullname || '',
          email: u.email || '',
          phone: u.phone || '',
          address: u.address || '',
          dateOfBirth: u.dateOfBirth ? u.dateOfBirth.substring(0, 10) : '',
          bio: u.bio || '',
        });
      } catch (e) {
        setError(e.response?.data?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchMe();
  }, []);


  useEffect(() => {
    if (!msg && !success && !error) return;

    const timer = setTimeout(() => {
      setMsg('');
      setSuccess('');
      setError('');
    }, 3000); // 3s

    return () => clearTimeout(timer);
  }, [msg, success, error]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const saveBasic = async (e) => {
    e.preventDefault();
    clearAlerts();
    try {
      setMsg('Saving...');
      await api.put('/users/me', form);
      await fetchMe();
      setMsg('');
      setSuccess('Saved successfully.');
      setTimeout(() => navigate('/profile', { replace: true }), 600);
    } catch (e) {
      setError(e.response?.data?.message || 'Save failed');
    }
  };

  const uploadFile = async (field, file) => {
    if (!file) return;
    clearAlerts();

    const fd = new FormData();
    fd.append(field, file);

    try {
      setMsg('Uploading...')
      await api.put(`/users/me/${field}`, fd);

      const me = await api.get('/users/me');
      setUser(me.data);

      setMsg('');
      setSuccess(`${field === 'avatar' ? 'Avatar' : 'Banner'} uploaded.`);
    } catch (e) {
      setMsg('');
      setError(e.response?.data?.message || 'Upload failed');
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    clearAlerts();
    if (pwd.newPassword !== pwd.confirm) {
      setError('New password and confirm do not match.');
      return;
    }
    try {
      setMsg('Updating password...');
      await api.put(`users/me/password`, {currentPassword: pwd.currentPassword, newPassword: pwd.newPassword });
      setMsg('');
      setSuccess('Password updated.');
      setPwd({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e) {
      setMsg('');
      setError(e.response?.data?.message || 'Update password failed');
    }
  };

  if (loading) return <div className="settings-wrap"><div className="settings-card">Loading...</div></div>;

  return (
    <div className="settings-wrap">
      <div className="settings-card">
        <h2>Update personal information</h2>

        <div className="tabs">
          <button className={tab === 'basic' ? 'active' : ''} onClick={() => setTab('basic')}>Basic information</button>
          <button className={tab === 'privacy' ? 'active' : ''} onClick={() => setTab('privacy')}>Privacy</button>
          <button className={tab === 'password' ? 'active' : ''} onClick={() => setTab('password')}>Change password</button>
        </div>

        {msg && <div className="alert info">{msg}</div>}
        {success && <div className="alert success">{success}</div>}
        {error && <div className="alert error">{error}</div>}

        {/* BASIC */}
        {tab === 'basic' && (
          <form className="form" onSubmit={saveBasic}>
            <div className="form-group">
              <label>Fullname</label>
              <input name="fullname" value={form.fullname} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input name="email" value={form.email} disabled />
              <small>
                BrainBoost does not support email changes. If you have purchased a course and wish to change your account, please contact us directly.
              </small>
            </div>

            <div className="form-group">
              <label>Phone</label>
              <input name="phone" value={form.phone} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>Address</label>
              <input name="address" value={form.address} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>Date of Birth</label>
              <input type="date" name="dateOfBirth" value={form.dateOfBirth} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>About myself</label>
              <textarea name="bio" rows={6} value={form.bio} onChange={handleChange} />
            </div>

            <div className="form-row">
              <div className="form-group half">
                <label>Avatar</label>
                <input type="file" accept="image/*" onChange={(e) => uploadFile('avatar', e.target.files?.[0])} />
              </div>
              <div className="form-group half">
                <label>Banner</label>
                <input type="file" accept="image/*" onChange={(e) => uploadFile('banner', e.target.files?.[0])} />
              </div>
            </div>

            <button className="save-btn" type="submit">Save</button>
          </form>
        )}

        {/* PRIVACY (placeholder) */}
        {tab === 'privacy' && (
          <div className="privacy-box">
            <p className="policy-line">
              Please read the{" "}
              <Link to="/privacy-policy" className="policy-link">Privacy Policy</Link>{" "}
              and{" "}
              <Link to="/terms-of-use" className="policy-link">Terms of Use</Link>.
            </p>
          </div>
        )}

        {/* CHANGE PASSWORD */}
        {tab === 'password' && (
          <form className="form" onSubmit={savePassword}>
            <div className="form-group">
              <label>Current password</label>
              <input type="password" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} />
            </div>
            <div className="form-group">
              <label>New password</label>
              <input type="password" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Confirm new password</label>
              <input type="password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} />
            </div>
            <button className="save-btn" type="submit">Save</button>
          </form>
        )}
      </div>
    </div>
  );
}
