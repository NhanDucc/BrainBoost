import { useState, useEffect } from 'react';
import { api } from '../api';
import { useNavigate, Link } from 'react-router-dom';
import '../css/Register.css';

const Register = () => {
    // ==== State & Routing Management ====

    const navigate = useNavigate();

    // -- Form Data States --
    const [fullname, setFullname] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    // -- UI & Feedback States --
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // ==== Lifecycle Effect ====

    /**
     * Auto-dismissal Effect
     * Automatically clears error alerts after 5 seconds to maintain a clean UI.
     */
    useEffect(() => {
        if (!error && !success) return;

        const t = setTimeout(() => {
            setError('');
            setSuccess('');
        }, 5000);

        return () => clearTimeout(t);
    }, [error, success]);

    // ==== Event Handlers ====

    /**
     * Handles the submission of the registration form.
     * Validates input, checks for common typos, sends data to the API, 
     * and routes the user to the OTP verification page.
     */
    const handleRegister = async (e) => {
        e.preventDefault(); 
        setError('');
        setSuccess('');

        // 1. Basic Password Match Validation
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        // 2. Frontend Typo Catcher (Lớp phòng ngự bắt lỗi gõ nhầm nhanh nhất)
        const suspiciousDomains = ['gmaill.com', 'gmail.com.vn', 'yaho.com', 'hotmal.com', 'gmal.com'];
        const domain = email.split('@')[1]?.toLowerCase();
        
        if (suspiciousDomains.includes(domain)) {
            setError(`Are you sure? "${domain}" looks like a typo. Please check your email again.`);
            return;
        }

        // 3. API Execution
        setIsLoading(true);
        try {
            await api.post('/auth/register', {
                fullname, 
                email, 
                password
            });

            // Save the email temporarily to local storage so the Verify page knows which account to verify
            localStorage.setItem('pendingEmail', email);

            // Redirect the user to the OTP Verification screen
            navigate('/verify');

        } catch (err) {
            console.error("Registration Error:", err.response || err);
            // Hiển thị lỗi từ Backend (Ví dụ: "Could not deliver OTP. Please ensure this email actually exists")
            setError(err.response?.data?.message || 'Registration failed. Please check your information and try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // ==== UI Render ====

    return (
        <div className="register-container">
            <form onSubmit={handleRegister} className="register-box">
                <h2>Create Account</h2>

                {/* Conditional rendering for feedback alerts */}
                {error && <p className="alert error">{error}</p>}
                {success && <p className="alert success">{success}</p>}

                {/* Fullname Input */}
                <label htmlFor="fullname">Fullname</label>
                <input
                    type="text"
                    id="fullname"
                    placeholder="Enter your full name"
                    value={fullname}
                    onChange={(e) => setFullname(e.target.value)}
                    disabled={isLoading}
                    required
                />

                {/* Email Input */}
                <label htmlFor="email">Email Address</label>
                <input
                    type="email"
                    id="email"
                    placeholder="Enter a valid email (e.g. name@gmail.com)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                />

                {/* Password Input */}
                <label htmlFor="password">Password</label>
                <div className="password-wrapper">
                    <input
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        placeholder="Create a strong password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        required
                    />
                    <i 
                        className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'} toggle-password`} 
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? "Hide password" : "Show password"}
                    ></i>
                </div>

                {/* Confirm Password Input */}
                <label htmlFor="confirm-password">Confirm Password</label>
                <div className="password-wrapper">
                    <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        id="confirm-password"
                        placeholder="Type your password again"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={isLoading}
                        required
                    />
                    <i 
                        className={`bi ${showConfirmPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'} toggle-password`} 
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        title={showConfirmPassword ? "Hide password" : "Show password"}
                    ></i>
                </div>

                {/* Submit Action */}
                <button className="register-btn" type="submit" disabled={isLoading}>
                    {isLoading ? "Verifying Email..." : "Register"}
                </button>

                {/* Navigation Links */}
                <p className="bottom-links">
                    Already have an account? <Link to="/login">Sign in</Link>
                </p>
            </form>
        </div>
    );
};

export default Register;