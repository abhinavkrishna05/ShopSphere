const User = require('../models/User');
const { AppError, asyncHandler } = require('../middlewares/errorHandler');

const getMe = asyncHandler(async (req, res) => {
  res.json({ success: true, data: req.user });
});

const updateMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new AppError('User not found', 404);

  const { name, email, password } = req.body;
  if (name !== undefined) user.name = name;
  if (email !== undefined) user.email = email;
  if (password !== undefined) {
    user.password = password; // hashed by pre-save hook
    user.refreshToken = null; // force re-login on other sessions
  }

  await user.save();
  res.json({ success: true, message: 'Profile updated', data: user });
});

const getAllUsers = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const filter = {};
  if (req.query.role) {
    if (!['customer', 'seller', 'admin'].includes(req.query.role)) {
      throw new AppError('role must be one of: customer, seller, admin', 400);
    }
    filter.role = req.query.role;
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: users,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

module.exports = { getMe, updateMe, getAllUsers };
