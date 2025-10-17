import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../css/VerifyCode.css';

const VerifyCode = () => {
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleVerify = async (e) => {
        e.preventDefault();
        setError('');

        const email = localStorage.getItem('pendingEmail');
        if (!email) {
            setError('No pending registration found. Please register first.');
            return;
        }

        try {
            const res = await axios.post('http://localhost:5000/api/auth/verify', { email, otp });
            alert(res.data.message);
            localStorage.removeItem('pendingEmail'); // Delete pending email after successful verification
            navigate('/login');
        } catch (err) {
            setError(err.response?.data?.message || 'Verification failed');
        }
    };

    return (
        <div className="verify-container">
            <form className="verify-box" onSubmit={handleVerify}>
                <h2>Verify Code</h2>
                {error && <p className="error">{error}</p>}

                <label htmlFor="otp">OTP</label>
                <input
                    type="text"
                    id="otp"
                    placeholder="Enter your verification code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                />

                <button type="submit" className="verify-btn">Verify</button>
            </form>
        </div>
    );
};

export default VerifyCode;
