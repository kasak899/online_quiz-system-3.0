const jwt  = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes — verify JWT token
const protect = async (req, res, next) => {
  let token = null;
  const authHeader = req.headers.authorization || '';

  // Support multiple Postman styles:
  // 1) Authorization: Bearer <token>
  // 2) Authorization: <token>
  // 3) x-auth-token: <token>
  if (typeof authHeader === 'string' && authHeader.trim()) {
    if (/^Bearer\s+/i.test(authHeader)) {
      token = authHeader.split(/\s+/)[1];
    } else {
      token = authHeader.trim();
    }
  } else if (req.headers['x-auth-token']) {
    token = String(req.headers['x-auth-token']).trim();
  }

  if (!token) {
    return res.status(401).json({
      message: 'Not authorized, no token. Send Authorization: Bearer <token>'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

// Role-based access
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Role '${req.user.role}' is not allowed to access this route`
      });
    }
    next();
  };
};

module.exports = { protect, authorizeRoles };
