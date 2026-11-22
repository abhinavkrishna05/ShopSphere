const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { AppError, asyncHandler } = require('../middlewares/errorHandler');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const formatCart = async (customerId) => {
  const cart = await Cart.findOne({ customer: customerId }).populate(
    'items.product',
    'name price stock seller'
  );

  if (!cart) return { items: [], totalAmount: 0, totalItems: 0 };

  // ignore products that were deleted after being added to cart
  const items = cart.items
    .filter((i) => i.product)
    .map((i) => ({
      product: i.product,
      quantity: i.quantity,
      subtotal: round2(i.product.price * i.quantity),
    }));

  return {
    _id: cart._id,
    items,
    totalAmount: round2(items.reduce((sum, i) => sum + i.subtotal, 0)),
    totalItems: items.reduce((sum, i) => sum + i.quantity, 0),
  };
};

const getCart = asyncHandler(async (req, res) => {
  const data = await formatCart(req.user._id);
  res.json({ success: true, data });
});

const addItem = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  const quantity = req.body.quantity === undefined ? 1 : req.body.quantity;

  const product = await Product.findById(productId);
  if (!product) throw new AppError('Product not found', 404);

  const cart = await Cart.findOneAndUpdate(
    { customer: req.user._id },
    { $setOnInsert: { items: [] } },
    { upsert: true, new: true }
  );

  const existing = cart.items.find((i) => String(i.product) === String(productId));
  const newQty = (existing ? existing.quantity : 0) + quantity;

  if (newQty > product.stock) {
    throw new AppError(`Only ${product.stock} unit(s) of "${product.name}" in stock`, 400);
  }

  if (existing) existing.quantity = newQty;
  else cart.items.push({ product: product._id, quantity });

  await cart.save();

  const data = await formatCart(req.user._id);
  res.status(201).json({ success: true, message: 'Item added to cart', data });
});

const updateItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;

  const cart = await Cart.findOne({ customer: req.user._id });
  const item = cart && cart.items.find((i) => String(i.product) === productId);
  if (!item) throw new AppError('Item not found in cart', 404);

  const product = await Product.findById(productId);
  if (!product) throw new AppError('Product no longer exists', 404);
  if (quantity > product.stock) {
    throw new AppError(`Only ${product.stock} unit(s) of "${product.name}" in stock`, 400);
  }

  item.quantity = quantity;
  await cart.save();

  const data = await formatCart(req.user._id);
  res.json({ success: true, message: 'Cart item updated', data });
});

const removeItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  const cart = await Cart.findOne({ customer: req.user._id });
  const exists = cart && cart.items.some((i) => String(i.product) === productId);
  if (!exists) throw new AppError('Item not found in cart', 404);

  cart.items = cart.items.filter((i) => String(i.product) !== productId);
  await cart.save();

  const data = await formatCart(req.user._id);
  res.json({ success: true, message: 'Item removed from cart', data });
});

module.exports = { getCart, addItem, updateItem, removeItem };
