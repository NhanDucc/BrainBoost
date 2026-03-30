import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import '../css/ForgotPassword.css';

const ForgotPassword = () => {
    // ==== State Management ====

    const navigate = useNavigate();

    // -- Data States --
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // -- UI Flow & Feedback States --
    // step 1: Enter email to request OTP. 
    // step 2: Enter OTP and new password to reset.
    const [step, setStep] = useState(1); 
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // ==== Form Handlers ====

    /**
     * STEP 1: Request OTP
     * Submits the user's email to the backend to generate and dispatch a One-Time Password.
     */
    const handleSendOTP = async (e) => {
        e.preventDefault(); // Prevent page reload
        
        try {
            await api.post('/auth/forgot-password/otp', { email });

            setMessage('OTP has been sent to your email.');
            setIsError(false);
            
            // Proceed to the next step to reveal OTP and New Password fields
            setStep(2);
        } catch (error) {
            console.error('Send OTP Error:', error);
            setMessage(error.response?.data?.message || 'Failed to send OTP. Please try again.');
            setIsError(true);
        }
    };

    /**
     * STEP 2: Verify & Reset
     * Submits the received OTP and the new password to finalize the reset process.
     */
    const handleResetPassword = async (e) => {
        e.preventDefault();
        
        try {
            await api.post('/auth/reset-password', {
                email,
                otp,
                newPassword,
            });

            setMessage('Password reset successfully! Redirecting to login...');
            setIsError(false);

            // Clear sensitive fields
            setOtp('');
            setNewPassword('');
            
            // Redirect user back to login page after a short delay
            setTimeout(() => {
                navigate('/login');
            }, 2000);

        } catch (error) {
            console.error('Reset Password Error:', error);
            setMessage(error.response?.data?.message || 'Failed to reset password. Invalid OTP.');
            setIsError(true);
        }
    };

    // ==== Lifecycle Effects ====

    /**
     * Auto-dismisses feedback messages (success or error) after 4 seconds 
     * to ensure the UI remains clean and uncluttered.
     */
    useEffect(() => {
        if (!message) return;

        const timer = setTimeout(() => {
            setMessage('');
            setIsError(false);
        }, 4000);

        // Cleanup function to prevent memory leaks if the component unmounts
        return () => clearTimeout(timer);
    }, [message]);
    
    // ==== UI Render ====

    return (
        <div className="forgotten-container">
            <form 
                className="forgotten-box"
                onSubmit={step === 1 ? handleSendOTP : handleResetPassword} 
            >
                <h2>Forgot Password</h2>

                {/* Feedback Alert Box */}
                {message && (
                    <p className={isError ? 'error' : 'success'}>
                        {message}
                    </p>
                )}
                
                {/* Email Field (Disabled in Step 2 to prevent email tampering after OTP is sent) */}
                <label>Email</label>
                <input
                    type="email"
                    placeholder="Enter your registered email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={step === 2} 
                    required
                />

                {/* Step 2 specific fields: OTP and New Password */}
                {step === 2 && (
                    <>
                        <label>OTP Code</label>
                        <input
                            type="text"
                            placeholder="Enter the 6-digit code"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            required
                        />
                        
                        <label>New Password</label>
                        <div className="password-wrapper">
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Enter your new password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                            />
                            {/* Password Visibility Toggle */}
                            <i 
                                className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'} toggle-password`} 
                                onClick={() => setShowPassword(!showPassword)}
                                title={showPassword ? "Hide password" : "Show password"}
                            ></i>
                        </div>
                    </>
                )}

                {/* Dynamic Submit Button */}
                <button type="submit">
                    {step === 1 ? 'Send OTP' : 'Reset Password'}
                </button>
                
            </form>
        </div>
    );
};

export default ForgotPassword;