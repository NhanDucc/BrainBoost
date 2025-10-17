import React, { useEffect, useState } from 'react';
import { api } from '../api';
import '../css/Contact.css';

export default function ApplyInstructor() {
  const [me, setMe] = useState({ fullname: '', email: '' });
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '',
    expertise: '', experience: '', bio: '', resumeUrl: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // auto-hide
  useEffect(() => {
    if (!error && !success) return;
    const t = setTimeout(() => { setError(''); setSuccess(''); }, 3000);
    return () => clearTimeout(t);
  }, [error, success]);

  // If logged in → auto-fill name and email (lock the email field to prevent discrepancies)
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/users/me');
        const u = res.data?.user || res.data;
        setMe({ fullname: u?.fullname || '', email: u?.email || '' });
        setForm(f => ({ ...f, fullName: u?.fullname || '', email: u?.email || '' }));
      } catch {}
    })();
  }, []);

  const onChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async e => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await api.post(`/instructors/apply`, form);
      setSuccess('Application sent! We will contact you via email.');
      setForm({ fullName: me.fullname, email: me.email, phone:'', expertise:'', experience:'', bio:'', resumeUrl:'' });
    } catch (err) {
      setError(err.response?.data?.message || 'Submit failed');
    }
  };

  return (
    <div className="contact-wrap">
      <div className="contact-card">
        <h1>Apply to become an Instructor</h1>
        <p className="lead">Fill the form below. Admin will review and notify you via email.</p>

        {(error || success) && <div className={`alert ${error ? 'alert-error':'alert-success'}`}>{error || success}</div>}

        <form className="contact-form" onSubmit={onSubmit}>
          <div className="row two">
            <div className="form-group">
              <label>Fullname*</label>
              <input name="fullName" value={form.fullName} onChange={onChange} required />
            </div>
            <div className="form-group">
              <label>Email*</label>
              <input name="email" value={form.email} onChange={onChange} required readOnly={!!me.email} />
            </div>
          </div>

          <div className="row two">
            <div className="form-group">
              <label>Phone</label>
              <input name="phone" value={form.phone} onChange={onChange} />
            </div>
            <div className="form-group">
              <label>Years of Experience</label>
              <input type="number" min="0" name="experience" value={form.experience} onChange={onChange} />
            </div>
          </div>

          <div className="form-group">
            <label>Expertise (subjects, skills)</label>
            <input name="expertise" value={form.expertise} onChange={onChange} placeholder="e.g., Math, Physics, IELTS..." />
          </div>

          <div className="form-group">
            <label>Short Bio</label>
            <textarea name="bio" rows={6} value={form.bio} onChange={onChange} />
          </div>

          <div className="form-group">
            <label>Resume/CV URL (optional)</label>
            <input name="resumeUrl" value={form.resumeUrl} onChange={onChange} placeholder="https://..." />
          </div>

          <button className="btn-send" type="submit">Submit Application</button>
        </form>
      </div>
    </div>
  );
}
