import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Create a globally configured Axios instance for making HTTP requests.
 * By exporting this instance, we ensure all API calls across the React app 
 * share the same base configuration.
 */
export const api = axios.create({
    // Automatically prepend this base URL to all request paths (e.g., api.post('/auth/login'))
    baseURL: API_URL,
    
    // Instructs the browser to securely send and receive cookies (like JWT session tokens) 
    // across different origins (e.g., from frontend port 3000 to backend port 5000).
    withCredentials: true,
});

/**
 * Helper function to extract the value of a specific cookie by its name.
 * @param {string} name - The name of the cookie to retrieve.
 * @returns {string|null} The cookie value, or null if not found.
 */
const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
};

/**
 * Intercepts outgoing requests to automatically attach security headers.
 * Specifically, it appends the CSRF Token to state-changing methods 
 * to protect against Cross-Site Request Forgery attacks.
 */
api.interceptors.request.use(
    (config) => {
        // State-changing HTTP methods that require CSRF protection
        const csrfMethods = ['post', 'put', 'patch', 'delete'];
        
        if (csrfMethods.includes(config.method?.toLowerCase())) {
            const csrfToken = getCookie('csrf_token');
            if (csrfToken) {
                config.headers['X-CSRF-Token'] = csrfToken;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

/**
 * Intercepts incoming responses to handle expired Access Tokens silently.
 * If a 401 TOKEN_EXPIRED error occurs, it pauses the request, calls the 
 * refresh endpoint to get a new token, and retries the original request.
 */
api.interceptors.response.use(
    (response) => {
        // Pass through successful responses without modification
        return response;
    },
    async (error) => {
        // Retrieve the original request configuration
        const originalRequest = error.config;

        // Condition Check: Is it a 401 error explicitly caused by token expiration?
        const isTokenExpired = error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED';

        // IMPORTANT: Check originalRequest.url !== '/auth/refresh' to prevent infinite loops
        // if the refresh API itself fails with a 401 error.
        if (isTokenExpired && !originalRequest._retry && originalRequest.url !== '/auth/refresh') {
            
            originalRequest._retry = true; // Mark as retried to prevent looping

            try {
                // Attempt to fetch a new Access Token using the httpOnly Refresh Token
                await api.post('/auth/refresh');

                // If successful, retry the exact same request that failed initially
                return api(originalRequest);

            } catch (refreshError) {
                // If the refresh token is also expired or invalid, the session is completely dead.
                console.error('Session expired. Please login again.');
                
                // PREVENT INFINITE LOOP: Only redirect if the user isn't already on the login page
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login'; 
                }
                
                return Promise.reject(refreshError);
            }
        }

        // For all other errors (400, 403, 404, 500, etc.), pass them down to the calling component
        return Promise.reject(error);
    }
);