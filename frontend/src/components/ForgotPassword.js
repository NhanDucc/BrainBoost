import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../css/ForgotPassword.css';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [step, setStep] = useState(1);
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');

    const handleSendOTP = async (e) => {
        e.preventDefault();
        try {
            await axios.post('http://localhost:5000/api/auth/forgot-password/otp', { email });
            setMessage('OTP sent to your email.');
            setIsError(false);
            setStep(2);
        } catch (error) {
            setMessage(error.response?.data?.message || 'Error sending OTP');
            setIsError(true);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        try {
            await axios.post('http://localhost:5000/api/auth/reset-password', {
                email,
                otp,
                newPassword,
            });
            setMessage('Password reset successfully!');
            setIsError(false);
            setStep(1);
        } catch (error) {
            setMessage(error.response?.data?.message || 'Reset failed');
            setIsError(true);
        }
    };

        useEffect(() => {
        if (!message) return;
        const t = setTimeout(() => {
        setMessage('');
        setIsError(false);
        }, 3000);
        return () => clearTimeout(t);
    }, [message]);
    
    return (
        <div className="forgotten-container">
            <form onSubmit={step === 1 ? handleSendOTP : handleResetPassword} className="forgotten-box">
                <h2>Forgot Password</h2>

                {message && <p className={isError ? 'error' : 'success'}>{message}</p>}
                
                <label>Email</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                {step === 2 && (
                    <>
                        <label>OTP</label>
                        <input
                            type="text"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            required
                        />
                        <label>New Password</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                        />
                    </>
                )}

                <button type="submit">{step === 1 ? 'Send OTP' : 'Reset Password'}</button>
            </form>
        </div>
    );
};

export default ForgotPassword;
