require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Order = require('../models/Order');

const seed = async () => {
  await connectDB();

  await Promise.all([
    Order.deleteMany({}),
    Cart.deleteMany({}),
    Product.deleteMany({}),
    Category.deleteMany({}),
    User.deleteMany({}),
  ]);

  // create() so the bcrypt pre-save hook runs
  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'Admin@123',
    role: 'admin',
  });
  const seller = await User.create({
    name: 'Seller One',
    email: 'seller@example.com',
    password: 'Seller@123',
    role: 'seller',
  });
  const customer = await User.create({
    name: 'Customer One',
    email: 'customer@example.com',
    password: 'Customer@123',
    role: 'customer',
  });

  const [electronics, fashion, books] = await Category.create([
    { name: 'Electronics', description: 'Gadgets and devices' },
    { name: 'Fashion', description: 'Clothing and accessories' },
    { name: 'Books', description: 'Printed and digital books' },
  ]);

  await Product.create([
    { name: 'Wireless Mouse', description: 'Ergonomic 2.4GHz wireless mouse', price: 799, stock: 50, category: electronics._id, seller: seller._id },
    { name: 'Mechanical Keyboard', description: 'RGB mechanical keyboard with blue switches', price: 3499, stock: 20, category: electronics._id, seller: seller._id },
    { name: 'Bluetooth Headphones', description: 'Noise cancelling over-ear headphones', price: 4999, stock: 8, category: electronics._id, seller: seller._id },
    { name: 'Cotton T-Shirt', description: 'Comfortable 100% cotton t-shirt', price: 499, stock: 100, category: fashion._id, seller: seller._id },
    { name: 'Denim Jacket', description: 'Classic blue denim jacket', price: 2199, stock: 4, category: fashion._id, seller: seller._id },
    { name: 'Node.js Design Patterns', description: 'Learn advanced Node.js architecture', price: 999, stock: 30, category: books._id, seller: seller._id },
    { name: 'MongoDB in Action', description: 'Practical guide to MongoDB and aggregation', price: 899, stock: 3, category: books._id, seller: seller._id },
  ]);

  console.log('\nSeed completed successfully\n');
  console.log('Admin    -> admin@example.com    / Admin@123');
  console.log('Seller   -> seller@example.com   / Seller@123');
  console.log('Customer -> customer@example.com / Customer@123\n');

  await mongoose.connection.close();
  process.exit(0);
};

seed().catch(async (err) => {
  console.error('Seed failed:', err);
  await mongoose.connection.close();
  process.exit(1);
});
