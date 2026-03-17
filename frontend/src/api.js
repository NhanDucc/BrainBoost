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
