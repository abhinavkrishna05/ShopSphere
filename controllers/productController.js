const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');
const { AppError, asyncHandler } = require('../middlewares/errorHandler');

const SORT_MAP = {
  price: { price: 1 },
  '-price': { price: -1 },
  price_asc: { price: 1 },
  price_desc: { price: -1 },
  name: { name: 1 },
  '-name': { name: -1 },
  createdAt: { createdAt: 1 },
  '-createdAt': { createdAt: -1 },
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  stock: { stock: 1 },
  '-stock': { stock: -1 },
};

const getProducts = asyncHandler(async (req, res) => {
  const { search, category, minPrice, maxPrice, sort } = req.query;
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);

  const filter = {};

  if (search && String(search).trim()) {
    filter.$text = { $search: String(search).trim() };
  }

  if (category) {
    if (!mongoose.isValidObjectId(category)) throw new AppError('Invalid category id', 400);
    filter.category = category;
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) {
      const min = Number(minPrice);
      if (!Number.isFinite(min)) throw new AppError('minPrice must be a number', 400);
      filter.price.$gte = min;
    }
    if (maxPrice !== undefined) {
      const max = Number(maxPrice);
      if (!Number.isFinite(max)) throw new AppError('maxPrice must be a number', 400);
      filter.price.$lte = max;
    }
    if (
      filter.price.$gte !== undefined &&
      filter.price.$lte !== undefined &&
      filter.price.$gte > filter.price.$lte
    ) {
      throw new AppError('minPrice cannot be greater than maxPrice', 400);
    }
  }

  if (sort && !SORT_MAP[sort]) {
    throw new AppError(`Invalid sort. Allowed: ${Object.keys(SORT_MAP).join(', ')}`, 400);
  }

  let query = Product.find(filter);
  if (filter.$text && !sort) {
    // relevance ranking when searching without explicit sort
    query = query
      .select({ score: { $meta: 'textScore' } })
      .sort({ score: { $meta: 'textScore' } });
  } else {
    query = query.sort(sort ? SORT_MAP[sort] : { createdAt: -1 });
  }

  const [products, total] = await Promise.all([
    query
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('category', 'name')
      .populate('seller', 'name email')
      .lean(),
    Product.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: products,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate('category', 'name description')
    .populate('seller', 'name email');
  if (!product) throw new AppError('Product not found', 404);
  res.json({ success: true, data: product });
});

const createProduct = asyncHandler(async (req, res) => {
  const categoryExists = await Category.exists({ _id: req.body.category });
  if (!categoryExists) throw new AppError('Category not found', 404);

  const product = await Product.create({ ...req.body, seller: req.user._id });
  res.status(201).json({ success: true, message: 'Product created', data: product });
});

const ensureOwnerOrAdmin = (product, user) => {
  if (user.role !== 'admin' && String(product.seller) !== String(user._id)) {
    throw new AppError('You can only modify your own products', 403);
  }
};

const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  ensureOwnerOrAdmin(product, req.user);

  if (req.body.category) {
    const categoryExists = await Category.exists({ _id: req.body.category });
    if (!categoryExists) throw new AppError('Category not found', 404);
  }

  Object.assign(product, req.body);
  await product.save();

  res.json({ success: true, message: 'Product updated', data: product });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new AppError('Product not found', 404);
  ensureOwnerOrAdmin(product, req.user);

  await product.deleteOne();
  res.json({ success: true, message: 'Product deleted' });
});

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
