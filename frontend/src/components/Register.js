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
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Lifecycle Effect ====

    /**
     * Auto-dismissal Effect
     * Automatically clears error or success alerts after 3 seconds to maintain a clean UI.
     */
    useEffect(() => {
        // Do nothing if there are no messages to display
        if (!error && !success) return;

        // Set a timer to clear messages
        const t = setTimeout(() => {
            setError('');
            setSuccess('');
        }, 3000);

        // Cleanup function to prevent memory leaks if the component unmounts
        return () => clearTimeout(t);
    }, [error, success]);

    // ==== Event Handlers ====

    /**
     * Handles the submission of the registration form.
     * Validates input, sends data to the API, and routes the user to the OTP verification page.
     */
    const handleRegister = async (e) => {
        e.preventDefault(); // Prevent default page reload

        // Reset feedback states before new submission
        setError('');
        setSuccess('');

        // Ensure passwords match
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        try {
            // API Call: Register the new user
            await api.post('/auth/register', {
                fullname, 
                email, 
                password
            });

            // Post-Registration Action:
            // Save the email temporarily to local storage so the Verify page knows which account to verify
            localStorage.setItem('pendingEmail', email);

            // Redirect the user to the OTP Verification screen
            navigate('/verify');

        } catch (err) {
            console.error("Registration Error:", err.response || err);
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        }
    };

    // ==== UI Render ====

    return (
        <div className="register-container">
            <form onSubmit={handleRegister} className="register-box">
                <h2>Register</h2>

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
                    required
                />

                {/* Email Input */}
                <label htmlFor="email">Email</label>
                <input
                    type="email"
                    id="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                {/* Password Input */}
                <label htmlFor="password">Password</label>
                <div className="password-wrapper">
                    <input
                        type={showPassword ? 'text' : 'password'}
                        id="password"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
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
                        placeholder="Confirm your password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                    <i 
                        className={`bi ${showConfirmPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'} toggle-password`} 
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        title={showConfirmPassword ? "Hide password" : "Show password"}
                    ></i>
                </div>

                {/* Submit Action */}
                <button className="register-btn" type="submit">
                    Register
                </button>

                {/* Navigation Links */}
                <p className="bottom-links">
                    You already have an account? <Link to="/login">Login</Link>
                </p>
            </form>
        </div>
    );
};

export default Register;