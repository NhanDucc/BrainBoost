import { useState, useEffect } from 'react';
import { api } from '../api';
import '../css/ForgotPassword.css';

const ForgotPassword = () => {
    // ==== State Management ====
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    
    // Controls the UI flow: Step 1 (Request OTP) -> Step 2 (Verify OTP & Reset)
    const [step, setStep] = useState(1);
    
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // ==== Form Handlers ====

    /**
     * Submits the user's email to request a One-Time Password (OTP).
     */
    const handleSendOTP = async (e) => {
        // Prevent default form submission behavior (page reload)
        e.preventDefault();
        try {
            // Make an API call using the configured axios instance
            await api.post('/auth/forgot-password/otp', { email });

            setMessage('OTP sent to your email.');
            setIsError(false);

            // Advance to the next step to reveal the OTP and Password input fields
            setStep(2);
        } catch (error) {
            setMessage(error.response?.data?.message || 'Error sending OTP');
            setIsError(true);
        }
    };

    /**
     * Submits the OTP and the new password for verification and update.
     */
    const handleResetPassword = async (e) => {
        e.preventDefault();
        try {
            // Send the required payload to finalize the password reset process
            await api.post('/auth/reset-password', {
                email,
                otp,
                newPassword,
            });

            setMessage('Password reset successfully!');
            setIsError(false);

            // Reset the flow back to the initial state after success
            setStep(1);
        } catch (error) {
            setMessage(error.response?.data?.message || 'Reset failed');
            setIsError(true);
        }
    };

    // ==== Lifecycle Hooks ====

    /**
     * Auto-dismisses success or error messages after 3 seconds.
     * This improves the UX by keeping the interface clean.
     */
    useEffect(() => {
        // Do nothing if there's no message to display
        if (!message) return;

        // Set a timer to clear the message state
        const t = setTimeout(() => {
            setMessage('');
            setIsError(false);
        }, 3000);

        // Cleanup function: Clear the timer if the component unmounts 
        // or if the message changes before the timer finishes
        return () => clearTimeout(t);
    }, [message]);
    
    // ==== UI Render ====

    return (
        <div className="forgotten-container">
            {/* Dynamically bind the onSubmit handler based on the current step */}
            <form onSubmit={step === 1 ? handleSendOTP : handleResetPassword} className="forgotten-box">
                <h2>Forgot Password</h2>

                {/* Conditional rendering for feedback messages */}
                {message && <p className={isError ? 'error' : 'success'}>{message}</p>}
                
                <label>Email</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                {/* Conditionally render OTP and Password fields only in Step 2 */}
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

                {/* Dynamic button label based on the current step */}
                <button type="submit">{step === 1 ? 'Send OTP' : 'Reset Password'}</button>
            </form>
        </div>
    );
};

export default ForgotPassword;