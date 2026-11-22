const router = require('express').Router();
const { authenticate, authorizeRoles } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { getCart, addItem, updateItem, removeItem } = require('../controllers/cartController');

const addItemSchema = {
  productId: { type: 'objectId', required: true },
  quantity: { type: 'number', integer: true, min: 1 },
};

const updateItemSchema = {
  quantity: { type: 'number', required: true, integer: true, min: 1 },
};

router.use(authenticate, authorizeRoles('customer'));

router.get('/', getCart);
router.post('/items', validate(addItemSchema), addItem);
router.patch('/items/:productId', validate(updateItemSchema), updateItem);
router.delete('/items/:productId', removeItem);

module.exports = router;
