const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError, asyncHandler } = require('../middlewares/errorHandler');

const signAccessToken = (user) =>
  jwt.sign({ id: String(user._id), role: user.role }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });

const signRefreshToken = (user) =>
  jwt.sign({ id: String(user._id) }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });

const register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  const exists = await User.findOne({ email });
  if (exists) throw new AppError('Email is already registered', 409);

  const user = await User.create({ name, email, password, role: role || 'customer' });

  res.status(201).json({
    success: true,
    message: 'Registered successfully',
    data: user,
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password +refreshToken');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  user.refreshToken = refreshToken;
  await user.save();

  res.json({
    success: true,
    message: 'Login successful',
    accessToken,
    refreshToken,
    user,
  });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await User.findById(decoded.id).select('+refreshToken');
  if (!user || !user.refreshToken || user.refreshToken !== refreshToken) {
    throw new AppError('Refresh token is not valid anymore. Please login again', 401);
  }

  const newAccessToken = signAccessToken(user);
  const newRefreshToken = signRefreshToken(user);

  user.refreshToken = newRefreshToken;
  await user.save();

  res.json({
    success: true,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  await User.updateOne({ refreshToken }, { $set: { refreshToken: null } });
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = { register, login, refresh, logout };
