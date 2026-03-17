import { useState, useEffect } from 'react';
import { api } from '../api';
import { useNavigate, Link } from 'react-router-dom';
import '../css/Register.css';

const Register = () => {
    // ==== Routing & Navigation ====
    const navigate = useNavigate();

    // ==== Form State Management ====
    const [fullname, setFullname] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    // ==== Feedback State Management ====
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    /**
     * Handles the submission of the registration form.
     * Validates input, sends data to the API, and routes the user to the OTP verification page.
     */
    const handleRegister = async (e) => {
        // Prevent page reload on form submit
        e.preventDefault();

        // Reset feedback states before new submission
        setError('');
        setSuccess('');

        // Client-side Validation: Ensure passwords match
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        try {
            // API Call: Send registration data to the backend
            // We just 'await' the operation to ensure it succeeds. 
            // The response variable is not assigned since its payload isn't needed here.
            await api.post('/auth/register', {
                fullname, email, password
            });

            // Post-Registration Action
            // Save the email temporarily to local storage so the Verify page knows which account to verify
            localStorage.setItem('pendingEmail', email);

            // Redirect the user to the OTP Verification screen
            navigate('/verify');
        } catch (error) {
            setError(error.response?.data?.message || 'Registration failed.');
        }
    };

    /**
     * Lifecycle Hook: Auto-dismissal of feedback messages.
     * Clears error or success alerts after 3 seconds to keep the UI clean.
     */
    useEffect(() => {
        // Do nothing if there are no messages to display
        if (!error && !success) return;

        // Set a timer to clear messages
        const t = setTimeout(() => {
            setError('');
            setSuccess('');
        }, 3000);

        // Cleanup function: Clear the timeout if the component unmounts
        // or if states change before the 3 seconds are up.
        return () => clearTimeout(t);
    }, [error, success]);

    // ==== UI Render ====

    return (
        <div className="register-container">
            <form onSubmit={handleRegister} className="register-box">
                <h2>Register</h2>

                {/* Conditional rendering for feedback alerts */}
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