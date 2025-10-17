import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import '../css/Login.css';

const Login = () => {
    const navigate = useNavigate();
    const { user, authResolved, fetchMe } = useUser();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');

    // If already logged in (after auth resolved), bounce away
    useEffect(() => {
        if (!authResolved) return;
        if (user) navigate('/', { replace: true });
    }, [authResolved, user, navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        try {
        await api.post('/auth/login', { email, password, remember: rememberMe });
        // refresh user
        await fetchMe();
        // route by role
        const role = (user && user.role) || 'student'; // might still be stale this tick
        // safer: fetch profile directly then route:
        const meRes = await api.get('/users/me');
        const me = meRes.data?.user || meRes.data || {};
        switch (me.role) {
            case 'admin':      navigate('/admin',      { replace: true }); break;
            case 'instructor': navigate('/instructor', { replace: true }); break;
            default:           navigate('/',           { replace: true });
        }
        } catch (err) {
        setError(err?.response?.data?.message || 'Login failed.');
        }
    };

    useEffect(() => {
        if (!error) return;
        const t = setTimeout(() => setError(''), 3000);
        return () => clearTimeout(t);
    }, [error]);

    return (
        <div className="login-container">
        <form onSubmit={handleLogin} className="login-box">
            <h2>Login</h2>
            {error && <p className="alert error">{error}</p>}
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
            <label htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />

            <div className="remember-row">
            <label className="checkbox-label">
                <input type="checkbox" checked={rememberMe} onChange={e=>setRememberMe(e.target.checked)} />
                <span>Remember me</span>
            </label>
            </div>

            <button className="login-btn" type="submit">Login</button>

            <p className="bottom-links">
            You don't have an account? <Link to="/register">Register</Link><br />
            <Link to="/forgot-password">Forgotten password?</Link>
            </p>
        </form>
        </div>
    );
};

export default Login;
