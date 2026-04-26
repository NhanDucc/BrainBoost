import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

/**
 * Create a globally configured Axios instance for making HTTP requests.
 * By exporting this instance, we ensure all API calls across the React app 
 * share the same base configuration.
 */
export const api = axios.create({
    // Automatically prepend this base URL to all request paths (e.g., api.post('/auth/login'))
    baseURL: API_URL,
    
    // Instructs the browser to securely send and receive cookies (like JWT session tokens) 
    // across different origins (e.g., from frontend port 80 to backend port 8080).
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
                config.headers['x-csrf-token'] = csrfToken;
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
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        const isUnauthorized = error.response?.status === 401 
            && !originalRequest.url.includes('/auth/login')
            && !originalRequest.url.includes('/auth/register')
            && !originalRequest.url.includes('/auth/logout');

        if (isUnauthorized && !originalRequest._retry && originalRequest.url !== '/auth/refresh') {

            if (isRefreshing) {
                return new Promise(function(resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(() => {
                    return api(originalRequest);
                }).catch(err => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                await api.post('/auth/refresh');
                
                isRefreshing = false;
                processQueue(null);
                
                return api(originalRequest);
                
            } catch (refreshError) {
                isRefreshing = false;
                processQueue(refreshError);
                
                console.error('Session completely expired or user is a guest.');
                
                const isCheckingSession = originalRequest.url.includes('/users/me');
                const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register';

                if (!isCheckingSession && !isAuthPage) {
                    window.location.href = '/login'; 
                }
                // ===================================

                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);