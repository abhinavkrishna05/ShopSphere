const Category = require('../models/Category');
const Product = require('../models/Product');
const { AppError, asyncHandler } = require('../middlewares/errorHandler');

const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().sort({ name: 1 });
  res.json({ success: true, count: categories.length, data: categories });
});

const createCategory = asyncHandler(async (req, res) => {
  const category = await Category.create(req.body);
  res.status(201).json({ success: true, message: 'Category created', data: category });
});

const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError('Category not found', 404);

  const inUse = await Product.exists({ category: category._id });
  if (inUse) {
    throw new AppError('Cannot delete a category that still has products', 400);
  }

  await category.deleteOne();
  res.json({ success: true, message: 'Category deleted' });
});

module.exports = { getCategories, createCategory, deleteCategory };
