import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import '../css/Register.css';

const Register = () => {
    const navigate = useNavigate();
    const [fullname, setFullname] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        try {
            const response = await axios.post('https://10.25.196.154:5000/api/auth/register', {
                fullname, email, password
            });

            localStorage.setItem('pendingEmail', email);
            navigate('/verify');
        } catch (error) {
            setError(error.response?.data?.message || 'Registration failed.');
        }
    };

    useEffect(() => {
        if (!error && !success) return;
        const t = setTimeout(() => {
        setError('');
        setSuccess('');
        }, 3000);
        return () => clearTimeout(t);
    }, [error, success]);

    return (
        <div className="register-container">
            <form onSubmit={handleRegister} className="register-box">
                <h2>Register</h2>

                {error && <p className="alert error">{error}</p>}
                {success && <p className="alert success">{success}</p>}

                <label htmlFor="fullname">Fullname</label>
                <input
                    type='text'
                    id="fullname"
                    placeholder='Enter your name'
                    value={fullname}
                    onChange={(e) => setFullname(e.target.value)}
                    required
                />

                <label htmlFor="email">Email</label>
                <input
                    type='email'
                    id="email"
                    placeholder='Enter your email'
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <label htmlFor="password">Password</label>
                <input
                    type='password'
                    id="password"
                    placeholder='Enter your password'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />

                <label htmlFor="confirm-password">Confirm Password</label>
                <input
                    type='password'
                    id="confirm-password"
                    placeholder='Confirm your password'
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                />

                <button className="register-btn" type='submit'>Register</button>

                <p className="bottom-links">
                    You already have an account? <Link to="/login">Login</Link>
                </p>
            </form>
        </div>
    );
};

export default Register;
