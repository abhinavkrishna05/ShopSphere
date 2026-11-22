const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError, asyncHandler } = require('./errorHandler');

// Verifies JWT access token (Authorization: Bearer <token>) and attaches req.user
const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('Authentication required. Please provide a Bearer token', 401);
  }

  const token = header.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
  } catch (err) {
    throw new AppError(
      err.name === 'TokenExpiredError' ? 'Access token expired' : 'Invalid access token',
      401
    );
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    throw new AppError('User belonging to this token no longer exists', 401);
  }

  req.user = user;
  next();
});

// RBAC: authorizeRoles('admin', 'seller')
const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }
  if (!roles.includes(req.user.role)) {
    return next(
      new AppError(`Role '${req.user.role}' is not allowed to access this resource`, 403)
    );
  }
  next();
};

module.exports = { authenticate, protect: authenticate, authorizeRoles };
