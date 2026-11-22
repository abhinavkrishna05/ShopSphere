const router = require('express').Router();
const { authenticate, authorizeRoles } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { getMe, updateMe, getAllUsers } = require('../controllers/userController');

const updateMeSchema = {
  name: { type: 'string', minLength: 2, maxLength: 100 },
  email: { type: 'string', email: true },
  password: { type: 'string', minLength: 6, maxLength: 128, trim: false },
};

router.use(authenticate);

router.get('/me', getMe);
router.patch('/me', validate(updateMeSchema, { partial: true }), updateMe);
router.get('/', authorizeRoles('admin'), getAllUsers);

module.exports = router;
