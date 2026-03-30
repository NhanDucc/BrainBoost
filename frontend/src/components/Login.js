import { useEffect, useState } from 'react';
import { api } from '../api';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import '../css/Login.css';

const Login = () => {

    // ==== State & Context Management ====

    const navigate = useNavigate();
    const { user, authResolved, fetchMe } = useUser();

    // -- Form Data States --
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);

    // -- UI & Feedback States --
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // ==== Lifecycle Effects ====

    /**
     * Auth Check Effect
     * Automatically redirects the user to the homepage if they are already logged in.
     * Waits for the global auth state (authResolved) to settle before checking.
     */
    useEffect(() => {
        if (!authResolved) return;
        if (user) navigate('/', { replace: true });
    }, [authResolved, user, navigate]);

    /**
     * Error Dismissal Effect
     * Automatically clears any error messages after 3 seconds to keep the UI clean.
     */
    useEffect(() => {
        if (!error) return;
        const t = setTimeout(() => setError(''), 3000);
        return () => clearTimeout(t);
    }, [error]);

    // ==== Event Handlers ====

    /**
     * Handles the login form submission.
     * Executes the 3-Token authentication flow and updates the global user context.
     */
    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        try {
            // Call login API to validate credentials and receive HTTP-only cookies
            await api.post('/auth/login', { 
                email, 
                password, 
                remember: rememberMe 
            });
            
            // Fetch user profile data to update the global React Context exactly once
            await fetchMe(); 

            // Redirect to homepage upon successful authentication
            navigate('/', { replace: true });

        } catch (err) {
            console.error("Detailed Login Error:", err.response || err);
            
            // Extract error message from backend or fallback to generic message
            setError(err?.response?.data?.message || 'Login failed. Please check your credentials.');
        }
    };

    // ==== UI Render ====

    return (
        <div className="login-container">
            <form onSubmit={handleLogin} className="login-box">
                <h2>Login</h2>
                
                {/* Error Feedback */}
                {error && <p className="alert error">{error}</p>}
                
                {/* Email Input */}
                <label htmlFor="email">Email</label>
                <input 
                    id="email" 
                    type="email" 
                    placeholder="Enter your email"
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    required 
                />
                
                {/* Password Input with Visibility Toggle */}
                <label htmlFor="password">Password</label>
                <div className="password-wrapper">
                    <input 
                        id="password" 
                        type={showPassword ? "text" : "password"} 
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

                {/* Remember Me Checkbox */}
                <div className="remember-row">
                    <label className="checkbox-label">
                        <input 
                            type="checkbox" 
                            checked={rememberMe} 
                            onChange={(e) => setRememberMe(e.target.checked)} 
                        />
                        <span>Remember me</span>
                    </label>
                </div>

                {/* Submit Action */}
                <button className="login-btn" type="submit">
                    Login
                </button>

                {/* Navigation Links */}
                <p className="bottom-links">
                    You don't have an account? <Link to="/register">Register</Link><br />
                    <Link to="/forgot-password">Forgotten password?</Link>
                </p>
            </form>
        </div>
    );
};

export default Login;