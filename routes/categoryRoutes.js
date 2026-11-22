const router = require('express').Router();
const { authenticate, authorizeRoles } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const {
  getCategories,
  createCategory,
  deleteCategory,
} = require('../controllers/categoryController');

const categorySchema = {
  name: { type: 'string', required: true, minLength: 2, maxLength: 100 },
  description: { type: 'string', maxLength: 500 },
};

router.get('/', getCategories);
router.post('/', authenticate, authorizeRoles('admin'), validate(categorySchema), createCategory);
router.delete('/:id', authenticate, authorizeRoles('admin'), deleteCategory);

module.exports = router;
