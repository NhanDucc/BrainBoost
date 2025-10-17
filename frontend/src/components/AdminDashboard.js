import React, { useEffect, useState } from 'react';
import SiteHeader from "./Header";
import SiteFooter from "./Footer";
import { api } from '../api';
import '../css/Admin.css';

export default function AdminDashboard() {
    const [apps, setApps] = useState([]);
    const [status, setStatus] = useState('pending');
    const [msg, setMsg] = useState('');

    const load = async () => {
        const res = await api.get(`/admin/instructors/applications?status=${status}`);
        setApps(res.data || []);
    };

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

    const act = async (id, type) => {
        const note = prompt(type === 'approve' ? 'Note to applicant (optional):' : 'Reason (optional):') || '';
        await api.patch(`/admin/instructors/applications/${id}/${type}`, { note });
        setMsg(type === 'approve' ? 'Approved.' : 'Rejected.');
        load();
        setTimeout(() => setMsg(''), 2500);
    };

    return (
        <div className="admin-page-container">
            <SiteHeader />
            <div className="settings-wrap admin-page">
                <div className="settings-card">
                    <h2>Admin Dashboard</h2>
                    <div style={{margin:'8px 0'}}>
                        <button className={status==='pending'?'active':''} onClick={()=>setStatus('pending')}>Pending</button>{' '}
                        <button className={status==='approved'?'active':''} onClick={()=>setStatus('approved')}>Approved</button>{' '}
                        <button className={status==='rejected'?'active':''} onClick={()=>setStatus('rejected')}>Rejected</button>
                    </div>

                    {msg && <div className="settings-msg">{msg}</div>}

                    <div className="results-table-wrap">
                        <table className="results-table">
                            <thead>
                            <tr>
                                <th>Fullname</th><th>Email</th><th>Phone</th><th>Expertise</th><th>Exp</th><th>Applied</th><th>Action</th>
                            </tr>
                            </thead>
                            <tbody>
                            {apps.map(a => (
                                <tr key={a._id}>
                                <td>{a.fullName}</td>
                                <td>{a.email}</td>
                                <td>{a.phone}</td>
                                <td>{a.expertise}</td>
                                <td>{a.experience || 0}</td>
                                <td>{new Date(a.createdAt).toLocaleString()}</td>
                                <td>
                                    {status==='pending'
                                    ? (<>
                                        <button onClick={()=>act(a._id,'approve')}>Approve</button>{' '}
                                        <button onClick={()=>act(a._id,'reject')}>Reject</button>
                                        </>)
                                    : <span>{a.status}</span>
                                    }
                                </td>
                                </tr>
                            ))}
                            {!apps.length && <tr><td colSpan="7" style={{textAlign:'center'}}>No applications</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <SiteFooter />
        </div>
    );
}
