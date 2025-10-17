const jwt = require('jsonwebtoken');
const COOKIE_NAME = 'bb_jwt';


exports.auth = (req, res, next) => {
    const cookieToken = req.cookies?.[COOKIE_NAME];
    const bearer = (req.headers.authorization || '').startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null;

    const token = cookieToken || bearer;
    if (!token) return res.status(401).json({ message: 'Missing token' });

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = payload.userId;
        req.userRole = payload.role;
        next();
    } catch (e) {
        return res.status(401).json({ message: 'Invalid token' });
    }
};

// Helper authorize
exports.authorize = (...roles) => (req, res, next) => {
    if (!roles.includes(req.userRole)) {
        return res.status(403).json({ message: 'Forbidden'});
    }
    next();
};