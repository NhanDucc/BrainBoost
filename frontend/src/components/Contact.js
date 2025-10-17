import React, { useEffect, useState } from 'react';
import { api } from '../api';
import SiteHeader from "./Header"
import SiteFooter from "./Footer"
import '../css/Contact.css';
import { useNavigate } from 'react-router-dom';

export default function Contact() {
    const navigate = useNavigate();

    const [me, setMe] = useState({ fullname: '', email: '' });
    const [form, setForm] = useState({
        subject: '',
        category: 'General',
        orderId: '',
        message: ''
    });

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (error || success) {
        const t = setTimeout(() => { setError(''); setSuccess(''); }, 3000);
        return () => clearTimeout(t);
        }
    }, [error, success]);

    useEffect(() => {
        (async () => {
        try {
            const res = await api.get('/users/me');
            const u = res.data?.user || res.data;
            setMe({ fullname: u?.fullname || '', email: u?.email || '' });
        } catch (e) {
            setError(e.response?.data?.message || 'Unable to load information.');
        }
        })();
    }, [navigate]);

    const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const onSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');
        try {
        await api.post('/contact', form)
        setSuccess('Your message has been sent successfully! Please check your email for our response.');
        setForm({ subject: '', category: 'General', orderId: '', message: '' });
        } catch (err) {
        setError(err.response?.data?.message || 'Failed to send your message.');
        }
    };

    return (
        <div className="contact-container">
            <SiteHeader />
            <div className="contact-wrap">
                <div className="contact-card">
                    <h1>Contact BrainBoost</h1>
                    <p className="lead">Submit your questions, feedback, or support requests. We will respond via your email.</p>

                    {(error || success) && (
                    <div className={`alert ${error ? 'alert-error' : 'alert-success'}`}>
                        {error || success}
                    </div>
                    )}

                    <form className="contact-form" onSubmit={onSubmit}>
                        <div className="row two">
                            <div className="form-group">
                            <label>Fullname</label>
                            <input value={me.fullname} disabled className="readonly" />
                            </div>
                            <div className="form-group">
                            <label>Email</label>
                            <input value={me.email} disabled className="readonly" title="Account email (not editable)" />
                            </div>
                        </div>

                        <div className="row two">
                            <div className="form-group">
                                <label>Subject<span>*</span></label>
                                <input
                                    name="subject"
                                    placeholder="Contact Subject"
                                    value={form.subject}
                                    onChange={onChange}
                                    required
                                    autoComplete="off"
                                />
                            </div>

                            <div className="form-group">
                                <label>Category</label>
                                <select
                                    name="category"
                                    value={form.category}
                                    onChange={onChange}
                                    className="nice-select"
                                >
                                    <option>General</option>
                                    <option>Bug Report</option>
                                    <option>Billing/Payment</option>
                                    <option>Course Request</option>
                                    <option>Account</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Order/Course ID (Option)</label>
                            <input
                            name="orderId"
                            placeholder="Ex: ORD-2025-00123 or Course: MATH-12"
                            value={form.orderId}
                            onChange={onChange}
                            autoComplete="off"
                            />
                        </div>

                        <div className="form-group">
                            <label>Message<span>*</span></label>
                            <textarea
                            name="message"
                            rows={8}
                            placeholder="Describe the issue and your support request..."
                            value={form.message}
                            onChange={onChange}
                            required
                            />
                        </div>

                        <button className="btn-send" type="submit">Send Message</button>
                    </form>
                </div>
            </div>
            <SiteFooter />
        </div>
    );
}
