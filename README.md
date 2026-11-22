# ShopSphere - E-Commerce & Inventory Management System

Full-stack capstone project (Project 4) built with **Node.js, Express.js, MongoDB (Mongoose)** and **Socket.IO**, with a lightweight vanilla JS frontend.

## Features
- JWT authentication (access + refresh tokens) with bcrypt password hashing
- Role-Based Access Control: `customer`, `seller`, `admin`
- Product catalog with search, category filter, price range, sorting and pagination
- Cart management and checkout with server-side price/stock validation
- Atomic stock updates (`findOneAndUpdate` + `$gte`) so stock never goes negative
- Order lifecycle: `PENDING -> CONFIRMED -> SHIPPED -> DELIVERED` (or `CANCELLED` with automatic stock restore)
- Real-time notifications using Socket.IO (`orderStatusUpdated`, `lowStockAlert`, `newOrder`)
- Event-driven architecture using Node `EventEmitter` (`order-placed`, `stock-low`)
- MongoDB Aggregation reports: sales and inventory
- Centralized error handling and request validation
- Built-in frontend (served from `/public`)

## Tech Stack
Node.js, Express.js, MongoDB, Mongoose, JWT, bcrypt, Socket.IO, HTML/CSS/JS

## Project Structure
```
├── app.js
├── server.js
├── config/db.js
├── models/            User, Category, Product, Cart, Order
├── middlewares/       auth, validate, errorHandler
├── controllers/       auth, user, category, product, cart, order, report
├── routes/            auth, user, category, product, cart, order, report
├── events/appEvents.js
├── sockets/socket.js
├── scripts/seed.js
└── public/index.html  (frontend)
```

## Database Design
- **Indexes on Product:** text index on `name` + `description`; compound index on `{ category: 1, price: 1 }`
- **Order** stores price/name snapshots of items, so later price changes do not affect past orders

## Setup
```bash
git clone <repo-url>
cd shopsphere-backend
npm install
cp .env.example .env      # then fill the values (Windows: Copy-Item .env.example .env)
npm run seed              # optional: demo data
npm run dev               # or: npm start
```
Open **http://localhost:5000** (frontend). API base: `http://localhost:5000/api`

### Environment Variables
| Key | Description |
|---|---|
| `PORT` | Server port (default 5000) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | JWT secrets |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | e.g. `15m` / `7d` |
| `LOW_STOCK_THRESHOLD` | Low-stock limit (default 5) |
| `CLIENT_URL` | CORS origin (`*` for dev) |

### Demo Credentials (after `npm run seed`)
| Role | Email | Password |
|---|---|---|
| Admin | admin@example.com | Admin@123 |
| Seller | seller@example.com | Seller@123 |
| Customer | customer@example.com | Customer@123 |

## API Reference
Protected routes need header: `Authorization: Bearer <accessToken>`

### Auth
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Register (customer/seller) |
| POST | `/api/auth/login` | Public | Returns accessToken + refreshToken |
| POST | `/api/auth/refresh` | Public | Rotate tokens using refreshToken |
| POST | `/api/auth/logout` | Public | Invalidate refreshToken |

### Users
| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/users/me` | Logged in |
| PATCH | `/api/users/me` | Logged in |
| GET | `/api/users` | Admin |

### Categories
| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/categories` | Public |
| POST | `/api/categories` | Admin |
| DELETE | `/api/categories/:id` | Admin |

### Products
| Method | Endpoint | Access |
|---|---|---|
| GET | `/api/products?search=&category=&minPrice=&maxPrice=&sort=&page=&limit=` | Public |
| GET | `/api/products/:id` | Public |
| POST | `/api/products` | Seller, Admin |
| PATCH | `/api/products/:id` | Owner seller, Admin |
| DELETE | `/api/products/:id` | Owner seller, Admin |

`sort` values: `price_asc`, `price_desc`, `newest`, `oldest`, `name`, `-name`, `stock`, `-stock`

### Cart (customer only)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/cart` | View cart |
| POST | `/api/cart/items` | `{ productId, quantity }` |
| PATCH | `/api/cart/items/:productId` | `{ quantity }` |
| DELETE | `/api/cart/items/:productId` | Remove item |

### Orders
| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/api/orders` | Customer | Checkout from cart `{ shippingAddress }` |
| GET | `/api/orders/my` | Customer | My orders |
| GET | `/api/orders` | Seller, Admin | All orders (seller sees own items) |
| PATCH | `/api/orders/:id/status` | Seller, Admin | `{ status }`; CANCELLED restores stock |

### Reports (Seller, Admin)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/reports/sales` | Total revenue, total orders, category-wise sales |
| GET | `/api/reports/inventory` | Best-selling and low-stock products |

## Real-Time Events (Socket.IO)
Connect with `io({ auth: { token: accessToken } })`

| Event | Receiver | Trigger |
|---|---|---|
| `orderStatusUpdated` | Customer | Order status changed |
| `lowStockAlert` | Seller + Admin | Stock falls below threshold |
| `newOrder` | Seller + Admin | Order placed |

## Error Format
```json
{ "success": false, "message": "Error message", "stack": "..." }
```
(`stack` is hidden when `NODE_ENV=production`)

## Author
Abhina Krishna 
