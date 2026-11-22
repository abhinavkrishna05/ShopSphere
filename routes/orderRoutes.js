const router = require('express').Router();
const { authenticate, authorizeRoles } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const {
  placeOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
} = require('../controllers/orderController');

const checkoutSchema = {
  shippingAddress: {
    type: 'object',
    required: true,
    fields: {
      fullName: { type: 'string', required: true, minLength: 2, maxLength: 100 },
      phone: { type: 'string', required: true, minLength: 7, maxLength: 20 },
      addressLine: { type: 'string', required: true, minLength: 3, maxLength: 200 },
      city: { type: 'string', required: true, maxLength: 100 },
      state: { type: 'string', required: true, maxLength: 100 },
      postalCode: { type: 'string', required: true, minLength: 3, maxLength: 12 },
      country: { type: 'string', maxLength: 100 },
    },
  },
};

const statusSchema = {
  status: {
    type: 'string',
    required: true,
    enum: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
  },
};

router.use(authenticate);

router.post('/', authorizeRoles('customer'), validate(checkoutSchema), placeOrder);
router.get('/my', authorizeRoles('customer'), getMyOrders);
router.get('/', authorizeRoles('seller', 'admin'), getAllOrders);
router.patch(
  '/:id/status',
  authorizeRoles('seller', 'admin'),
  validate(statusSchema),
  updateOrderStatus
);

module.exports = router;
