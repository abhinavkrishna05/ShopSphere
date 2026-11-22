const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Order = require('../models/Order');
const appEvents = require('../events/appEvents');
const { emitOrderStatusUpdated } = require('../sockets/socket');
const { AppError, asyncHandler } = require('../middlewares/errorHandler');

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const lowStockThreshold = () => Number(process.env.LOW_STOCK_THRESHOLD) || 5;

const ALLOWED_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

const restoreStock = (items) =>
  Promise.all(
    items.map((i) =>
      Product.updateOne({ _id: i.product }, { $inc: { stock: i.quantity } })
    )
  );

// POST /api/orders  (checkout from cart)
const placeOrder = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ customer: req.user._id });
  if (!cart || cart.items.length === 0) throw new AppError('Your cart is empty', 400);

  // 1) Re-validate products, stock and price from DB (never trust client)
  const products = await Product.find({ _id: { $in: cart.items.map((i) => i.product) } });
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const orderItems = [];
  for (const item of cart.items) {
    const product = productMap.get(String(item.product));
    if (!product) {
      throw new AppError(
        'A product in your cart is no longer available. Please remove it and try again',
        400
      );
    }
    if (product.stock < item.quantity) {
      throw new AppError(
        `Insufficient stock for "${product.name}". Available: ${product.stock}`,
        400
      );
    }
    orderItems.push({
      product: product._id,
      seller: product.seller,
      name: product.name,
      price: product.price, // price snapshot
      quantity: item.quantity,
    });
  }

  // 2) Total calculated on server
  const totalAmount = round2(orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0));

  // 3) Atomic stock decrement (never goes negative) with manual rollback
  const reserved = [];
  const updatedProducts = [];
  let order;
  try {
    for (const item of orderItems) {
      const updated = await Product.findOneAndUpdate(
        { _id: item.product, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
      if (!updated) {
        throw new AppError(`"${item.name}" just went out of stock. Please review your cart`, 409);
      }
      reserved.push(item);
      updatedProducts.push(updated);
    }

    order = await Order.create({
      customer: req.user._id,
      items: orderItems,
      totalAmount,
      shippingAddress: req.body.shippingAddress,
      paymentStatus: 'SIMULATED_PAID',
      status: 'PENDING',
    });
  } catch (err) {
    await restoreStock(reserved);
    throw err;
  }

  // 4) Clear cart
  await Cart.updateOne({ customer: req.user._id }, { $set: { items: [] } });

  // 5) Events
  appEvents.emit('order-placed', {
    orderId: String(order._id),
    customerId: String(req.user._id),
    totalAmount: order.totalAmount,
    itemCount: order.items.length,
    sellerIds: [...new Set(order.items.map((i) => String(i.seller)))],
  });

  const threshold = lowStockThreshold();
  updatedProducts
    .filter((p) => p.stock < threshold)
    .forEach((p) =>
      appEvents.emit('stock-low', {
        productId: String(p._id),
        name: p.name,
        stock: p.stock,
        sellerId: String(p.seller),
      })
    );

  res.status(201).json({ success: true, message: 'Order placed successfully', data: order });
});

// GET /api/orders/my
const getMyOrders = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
  const filter = { customer: req.user._id };

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: orders,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// GET /api/orders  (seller: orders containing their products | admin: all)
const getAllOrders = asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);

  const filter = {};
  if (req.query.status) {
    if (!Object.keys(ALLOWED_TRANSITIONS).includes(req.query.status)) {
      throw new AppError(`status must be one of: ${Object.keys(ALLOWED_TRANSITIONS).join(', ')}`, 400);
    }
    filter.status = req.query.status;
  }
  const isSeller = req.user.role === 'seller';
  if (isSeller) filter['items.seller'] = req.user._id;

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('customer', 'name email')
      .lean(),
    Order.countDocuments(filter),
  ]);

  // sellers only see their own line items
  const data = isSeller
    ? orders.map((o) => {
        const items = o.items.filter((i) => String(i.seller) === String(req.user._id));
        return {
          ...o,
          items,
          sellerTotal: round2(items.reduce((s, i) => s + i.price * i.quantity, 0)),
        };
      })
    : orders;

  res.json({
    success: true,
    data,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// PATCH /api/orders/:id/status
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  const order = await Order.findById(req.params.id);
  if (!order) throw new AppError('Order not found', 404);

  if (
    req.user.role === 'seller' &&
    !order.items.some((i) => String(i.seller) === String(req.user._id))
  ) {
    throw new AppError('This order does not contain any of your products', 403);
  }

  const allowed = ALLOWED_TRANSITIONS[order.status] || [];
  if (!allowed.includes(status)) {
    throw new AppError(
      `Cannot change order status from ${order.status} to ${status}`,
      400
    );
  }

  // Atomic guard: only one request can move the order out of its current status
  // (prevents double stock restoration on concurrent cancels)
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, status: order.status },
    { $set: { status } },
    { new: true }
  );
  if (!updated) throw new AppError('Order status was changed by someone else. Please retry', 409);

  if (status === 'CANCELLED') {
    await restoreStock(updated.items);
  }

  emitOrderStatusUpdated(updated.customer, {
    orderId: String(updated._id),
    status: updated.status,
    message: `Your order ${updated._id} is now ${updated.status}`,
    updatedAt: updated.updatedAt,
  });

  res.json({ success: true, message: `Order status updated to ${status}`, data: updated });
});

module.exports = { placeOrder, getMyOrders, getAllOrders, updateOrderStatus };
