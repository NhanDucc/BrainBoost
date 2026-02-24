import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useUser } from '../context/UserContext';
import '../css/UpdateProfile.css';

export default function UpdateProfile() {
  const { fetchMe, setUser } = useUser();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const clearAlerts = () => { setMsg(''); setSuccess(''); setError(''); };

  // Basic info state
  const [form, setForm] = useState({
    fullname: '',
    email: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    bio: '',
  });

  // Fetch user data on mount
  useEffect(() => {
    const loadProfile = async () => {
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
    loadProfile();
  }, []);

  // Auto-hide alerts
  useEffect(() => {
    if (!msg && !success && !error) return;
    const timer = setTimeout(() => clearAlerts(), 3000);
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
      setSuccess('Profile updated successfully.');
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

  if (loading) return <div className="settings-wrap"><div className="settings-card">Loading...</div></div>;

  return (
    <div style={{ backgroundColor: '#edf2fb', minHeight: '100vh' }}>
      <div className="settings-wrap" style={{ margin: '40px auto' }}>
        <div className="settings-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
            <button className="ghost-btn" onClick={() => navigate('/profile')} style={{ padding: '6px 12px' }}>
              <i className="bi bi-arrow-left"></i> Back
            </button>
            <h2 style={{ margin: 0 }}>Update Personal Information</h2>
          </div>

          {msg && <div className="alert info">{msg}</div>}
          {success && <div className="alert success">{success}</div>}
          {error && <div className="alert error">{error}</div>}

          <form className="form" onSubmit={saveBasic}>
            <div className="form-group">
              <label>Fullname</label>
              <input name="fullname" value={form.fullname} onChange={handleChange} required />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input name="email" value={form.email} disabled style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }} />
              <small>Email cannot be changed directly. Please contact support if needed.</small>
            </div>

            <div className="form-row">
              <div className="form-group half">
                <label>Phone</label>
                <input name="phone" value={form.phone} onChange={handleChange} />
              </div>
              <div className="form-group half">
                <label>Date of Birth</label>
                <input type="date" name="dateOfBirth" value={form.dateOfBirth} onChange={handleChange} />
              </div>
            </div>

            <div className="form-group">
              <label>Address</label>
              <input name="address" value={form.address} onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>About myself (Bio)</label>
              <textarea name="bio" rows={4} value={form.bio} onChange={handleChange} placeholder="Tell us a bit about your learning goals..." />
            </div>

            <div className="form-row" style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
              <div className="form-group half">
                <label>Profile Avatar</label>
                <input type="file" accept="image/*" onChange={(e) => uploadFile('avatar', e.target.files?.[0])} />
              </div>
              <div className="form-group half">
                <label>Cover Banner</label>
                <input type="file" accept="image/*" onChange={(e) => uploadFile('banner', e.target.files?.[0])} />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="primary-btn" type="submit" style={{ minWidth: '150px' }}>Save Changes</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}