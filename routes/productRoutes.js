const router = require('express').Router();
const { authenticate, authorizeRoles } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} = require('../controllers/productController');

const createSchema = {
  name: { type: 'string', required: true, minLength: 2, maxLength: 200 },
  description: { type: 'string', maxLength: 2000 },
  price: { type: 'number', required: true, min: 0 },
  stock: { type: 'number', required: true, min: 0, integer: true },
  category: { type: 'objectId', required: true },
};

router.get('/', getProducts);
router.get('/:id', getProductById);

router.post(
  '/',
  authenticate,
  authorizeRoles('seller', 'admin'),
  validate(createSchema),
  createProduct
);
router.patch(
  '/:id',
  authenticate,
  authorizeRoles('seller', 'admin'),
  validate(createSchema, { partial: true }),
  updateProduct
);
router.delete('/:id', authenticate, authorizeRoles('seller', 'admin'), deleteProduct);

module.exports = router;
