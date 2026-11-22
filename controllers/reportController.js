const Order = require('../models/Order');
const Product = require('../models/Product');
const { AppError, asyncHandler } = require('../middlewares/errorHandler');

const lineRevenue = { $multiply: ['$items.price', '$items.quantity'] };

// GET /api/reports/sales
const salesReport = asyncHandler(async (req, res) => {
  const isSeller = req.user.role === 'seller';

  const pipeline = [{ $match: { status: { $ne: 'CANCELLED' } } }, { $unwind: '$items' }];
  if (isSeller) pipeline.push({ $match: { 'items.seller': req.user._id } });

  pipeline.push({
    $facet: {
      totals: [
        {
          $group: {
            _id: null,
            revenue: { $sum: lineRevenue },
            orders: { $addToSet: '$_id' },
            unitsSold: { $sum: '$items.quantity' },
          },
        },
        {
          $project: {
            _id: 0,
            totalRevenue: { $round: ['$revenue', 2] },
            totalOrders: { $size: '$orders' },
            unitsSold: 1,
          },
        },
      ],
      categoryWise: [
        {
          $lookup: {
            from: 'products',
            localField: 'items.product',
            foreignField: '_id',
            as: 'prod',
          },
        },
        { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$prod.category',
            revenue: { $sum: lineRevenue },
            unitsSold: { $sum: '$items.quantity' },
            orders: { $addToSet: '$_id' },
          },
        },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'cat',
          },
        },
        { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            categoryId: '$_id',
            category: { $ifNull: ['$cat.name', 'Uncategorized'] },
            revenue: { $round: ['$revenue', 2] },
            unitsSold: 1,
            orders: { $size: '$orders' },
          },
        },
        { $sort: { revenue: -1 } },
      ],
    },
  });

  const [result] = await Order.aggregate(pipeline);
  const totals = (result.totals && result.totals[0]) || {
    totalRevenue: 0,
    totalOrders: 0,
    unitsSold: 0,
  };

  res.json({
    success: true,
    data: {
      totalRevenue: totals.totalRevenue,
      totalOrders: totals.totalOrders,
      unitsSold: totals.unitsSold,
      categoryWiseSales: result.categoryWise,
    },
  });
});

// GET /api/reports/inventory
const inventoryReport = asyncHandler(async (req, res) => {
  const isSeller = req.user.role === 'seller';
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

  let threshold = Number(process.env.LOW_STOCK_THRESHOLD) || 5;
  if (req.query.threshold !== undefined) {
    threshold = Number(req.query.threshold);
    if (!Number.isFinite(threshold) || threshold < 0) {
      throw new AppError('threshold must be a non-negative number', 400);
    }
  }

  const bestSellingPipeline = [{ $match: { status: { $ne: 'CANCELLED' } } }, { $unwind: '$items' }];
  if (isSeller) bestSellingPipeline.push({ $match: { 'items.seller': req.user._id } });
  bestSellingPipeline.push(
    {
      $group: {
        _id: '$items.product',
        name: { $first: '$items.name' },
        unitsSold: { $sum: '$items.quantity' },
        revenue: { $sum: lineRevenue },
      },
    },
    { $sort: { unitsSold: -1, revenue: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'prod',
      },
    },
    { $unwind: { path: '$prod', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        productId: '$_id',
        name: 1,
        unitsSold: 1,
        revenue: { $round: ['$revenue', 2] },
        currentStock: { $ifNull: ['$prod.stock', null] },
      },
    }
  );

  const lowStockMatch = { stock: { $lt: threshold } };
  if (isSeller) lowStockMatch.seller = req.user._id;

  const lowStockPipeline = [
    { $match: lowStockMatch },
    { $sort: { stock: 1, name: 1 } },
    {
      $lookup: {
        from: 'categories',
        localField: 'category',
        foreignField: '_id',
        as: 'cat',
      },
    },
    { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        productId: '$_id',
        name: 1,
        stock: 1,
        price: 1,
        seller: 1,
        category: '$cat.name',
      },
    },
  ];

  const [bestSellingProducts, lowStockProducts] = await Promise.all([
    Order.aggregate(bestSellingPipeline),
    Product.aggregate(lowStockPipeline),
  ]);

  res.json({
    success: true,
    data: { lowStockThreshold: threshold, bestSellingProducts, lowStockProducts },
  });
});

module.exports = { salesReport, inventoryReport };
