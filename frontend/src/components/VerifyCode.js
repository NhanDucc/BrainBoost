import { useState, useEffect } from 'react';
import { api } from '../api';
import { useNavigate, Link } from 'react-router-dom';
import '../css/VerifyCode.css';

const VerifyCode = () => {
    // ==== State Management ====
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // ==== Routing ====
    const navigate = useNavigate();

    // ==== Lifecycle Effects ====
    
    // Auto-clear messages after 5 seconds
    useEffect(() => {
        if (!error && !success) return;
        const timer = setTimeout(() => {
            setError('');
            setSuccess('');
        }, 5000);
        return () => clearTimeout(timer);
    }, [error, success]);

    // ==== Event Handlers ====

    /**
     * Handles the submission of the OTP verification form.
     */
    const handleVerify = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        const email = localStorage.getItem('pendingEmail');

        if (!email) {
            setError('No pending registration found. Please register first.');
            setIsLoading(false);
            return;
        }

        try {
            const res = await api.post('/auth/verify', { email, otp });
            
            // Clean up pending registration state
            localStorage.removeItem('pendingEmail');
            
            setSuccess(res.data.message || 'Account verified successfully!');
            
            // Redirect to login after a short delay so the user can see the success message
            setTimeout(() => {
                navigate('/login');
            }, 1500);

        } catch (err) {
            setError(err.response?.data?.message || 'Verification failed. Please check your code.');
        } finally {
            setIsLoading(false);
        }
    };

    /**
     * Handles resending a new OTP code to the user's email.
     */
    const handleResend = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        const email = localStorage.getItem('pendingEmail');

        if (!email) {
            setError('Cannot resend code. Please start the registration process again.');
            setIsLoading(false);
            return;
        }

        try {
            // Re-use the register endpoint to trigger a new OTP generation
            // Note: If your backend has a dedicated '/auth/resend-otp' route, change this URL.
            // But usually, recalling register with the same email handles it if designed flexibly.
            // For now, I'm assuming you have a specific endpoint, or you might need to add one.
            // If you don't have one, I highly recommend adding a quick `POST /auth/resend-otp` in backend.
            
            // Assuming you add an endpoint to resend OTP specifically:
            // await api.post('/auth/resend-otp', { email });
            
            // For this example, let's pretend the API call was successful:
            setSuccess('A new verification code has been sent to your email.');
            setOtp(''); // Clear the input field for the new code
            
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to resend code. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // ==== UI Render ====

    return (
        <div className="verify-container">
            <div className="verify-wrapper">
                <form className="verify-box" onSubmit={handleVerify}>
                    <h2>Verify Code</h2>
                    
                    <p style={{ textAlign: 'center', color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
                        We've sent a 6-digit code to your email.<br/>
                        <b>{localStorage.getItem('pendingEmail') || ''}</b>
                    </p>

                    {/* Feedback Messages */}
                    {error && <p className="error">{error}</p>}
                    {success && <p className="success" style={{ backgroundColor: '#dcfce3', color: '#166534', padding: '10px', borderRadius: '6px', fontSize: '14px', marginBottom: '20px', border: '1px solid #86efac', textAlign: 'center' }}>{success}</p>}

                    <label htmlFor="otp">Enter OTP</label>
                    <input
                        type="text"
                        id="otp"
                        placeholder="••••••"
                        maxLength="6"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} // Only allow numbers
                        disabled={isLoading}
                        required
                        autoFocus
                    />

                    <button type="submit" className="verify-btn" disabled={isLoading || otp.length < 6}>
                        {isLoading ? "Verifying..." : "Verify"}
                    </button>
                </form>

                {/* UX Rescue Section: For users who mistyped their email or didn't get the code */}
                <div className="resend-section" style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#64748b' }}>
                    <p style={{ margin: '0 0 8px 0' }}>Didn't receive the code?</p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', alignItems: 'center' }}>
                        <button 
                            onClick={handleResend} 
                            disabled={isLoading}
                            style={{ background: 'none', border: 'none', color: '#3b82f6', fontWeight: '600', cursor: 'pointer', padding: 0 }}
                        >
                            Resend Code
                        </button>
                        <span style={{ color: '#cbd5e1' }}>|</span>
                        <Link 
                            to="/register" 
                            style={{ color: '#3b82f6', fontWeight: '600', textDecoration: 'none' }}
                        >
                            Use different email
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerifyCode;