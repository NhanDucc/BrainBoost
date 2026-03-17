import { useState } from 'react';
import { api } from '../api';
import { useNavigate } from 'react-router-dom';
import '../css/VerifyCode.css';

const VerifyCode = () => {
    // ==== State Management ====
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    
    // ==== Routing ====
    const navigate = useNavigate();

    /**
     * Handles the submission of the OTP verification form.
     * Retrieves the pending email from local storage and sends it along with the OTP to the backend.
     */
    const handleVerify = async (e) => {
        // Prevent default form submission (page reload)
        e.preventDefault();
        // Clear any previous error messages
        setError('');

        // Retrieve the email saved during the Registration step
        const email = localStorage.getItem('pendingEmail');

        // Guard clause: Ensure the user actually went through the registration process first
        if (!email) {
            setError('No pending registration found. Please register first.');
            return;
        }

        try {
            // Make an API call to verify the OTP against the stored email
            const res = await api.post('/auth/verify', { email, otp });

            // Notify the user of successful verification
            alert(res.data.message);

            // Cleanup: Remove the pending email from local storage to maintain security and clean state
            localStorage.removeItem('pendingEmail');

            // Redirect the user to the login page so they can access their new account
            navigate('/login');
        } catch (err) {
            setError(err.response?.data?.message || 'Verification failed');
        }
    };

    // ==== UI Render ====

    return (
        <div className="verify-container">
            <form className="verify-box" onSubmit={handleVerify}>
                <h2>Verify Code</h2>

                {/* Conditional rendering for error feedback */}
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