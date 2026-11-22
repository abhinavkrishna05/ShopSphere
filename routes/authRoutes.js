const router = require('express').Router();
const validate = require('../middlewares/validate');
const { register, login, refresh, logout } = require('../controllers/authController');

const registerSchema = {
  name: { type: 'string', required: true, minLength: 2, maxLength: 100 },
  email: { type: 'string', required: true, email: true },
  password: { type: 'string', required: true, minLength: 6, maxLength: 128, trim: false },
  role: { type: 'string', enum: ['customer', 'seller'] },
};

const loginSchema = {
  email: { type: 'string', required: true, email: true },
  password: { type: 'string', required: true, trim: false },
};

const tokenSchema = {
  refreshToken: { type: 'string', required: true },
};

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', validate(tokenSchema), refresh);
router.post('/logout', validate(tokenSchema), logout);

module.exports = router;
