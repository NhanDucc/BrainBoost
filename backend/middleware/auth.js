const jwt = require('jsonwebtoken');

/**
 * auth: Middleware to protect private routes.
 * * This middleware performs two critical security checks for the 3-Token Architecture:
 * 1. Anti-CSRF Validation: For state-changing requests, ensures the frontend possesses 
 * the valid CSRF token.
 * 2. JWT Verification: Validates the short-lived Access Token.
 * * If the token is expired, it explicitly returns a 'TOKEN_EXPIRED' code so the 
 * frontend Axios interceptor knows to silently request a new token via the refresh endpoint.
 */
exports.auth = (req, res, next) => {
    // Extract Access Token from cookies or Authorization header (Bearer token fallback)
    const accessToken = req.cookies?.access_token || 
        (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

    if (!accessToken) {
        return res.status(401).json({ message: 'Missing token' });
    }

    // Anti-CSRF Protection (Cross-Site Request Forgery)
    // We only apply CSRF checks to methods that modify data (mutate state).
    // Safe methods like GET or OPTIONS do not need this check.
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const csrfCookie = req.cookies?.csrf_token;
        const csrfHeader = req.headers['x-csrf-token'];
        
        // Both the cookie and the header must exist and match exactly.
        if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
            return res.status(403).json({ message: 'CSRF validation failed' });
        }
    }

    // Verify JWT Access Token
    try {
        const payload = jwt.verify(accessToken, process.env.JWT_SECRET);
        
        // Attach user info to the request object for downstream controllers to use
        req.userId = payload.userId;
        req.userRole = payload.role;
        req.user = { id: payload.userId, role: payload.role };
        
        next(); // Proceed to the next middleware or route handler
    } catch (e) {
        // Special case: Tell the frontend precisely that the token EXPIRED
        // so it can trigger the silent Refresh Token flow without kicking the user out.
        if (e.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired', code: 'TOKEN_EXPIRED' });
        }
        
        // Fallback for manipulated, malformed, or entirely invalid tokens
        return res.status(401).json({ message: 'Invalid token' });
    }
};

/**
 * authorize: Middleware to restrict endpoint access based on user roles.
 * * MUST be used AFTER the `auth` middleware (which populates req.userRole).
 * * @param  {...string} roles - An array of allowed roles (e.g., 'admin', 'instructor')
 * @returns 403 Forbidden if the user's role is not in the allowed list.
 */
exports.authorize = (...roles) => (req, res, next) => {
    // Ensure the user role from the decoded JWT is among the permitted roles
    if (!roles.includes(req.userRole)) {
        return res.status(403).json({ message: 'Forbidden: Insufficient privileges' });
    }
    
    next(); // Role is authorized, proceed to the actual controller.
};