const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

let io = null;

/*
 * Client connects with: io(URL, { auth: { token: '<accessToken>' } })
 * Access token payload is expected to be { id, role }.
 */
const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: process.env.CLIENT_URL || '*', methods: ['GET', 'POST'] },
  });

  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization || '').replace('Bearer ', '');
      if (!token) return next(new Error('Authentication error: token missing'));

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      socket.user = { id: String(decoded.id), role: decoded.role };
      next();
    } catch (err) {
      next(new Error('Authentication error: invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.user;
    socket.join(`user:${id}`);
    socket.join(`role:${role}`);
    console.log(`[SOCKET] connected: ${socket.id} (user ${id}, ${role})`);

    socket.on('disconnect', () => {
      console.log(`[SOCKET] disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => io;

// Safe emitters (no-op if socket server is not initialised)
const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return;
  io.to(`user:${String(userId)}`).emit(event, payload);
};

const emitToAdmins = (event, payload) => {
  if (!io) return;
  io.to('role:admin').emit(event, payload);
};

// Notify customer when order status changes
const emitOrderStatusUpdated = (customerId, payload) => {
  emitToUser(customerId, 'orderStatusUpdated', payload);
};

// Notify admins + owning seller of low stock
const emitLowStockAlert = (sellerId, payload) => {
  emitToAdmins('lowStockAlert', payload);
  emitToUser(sellerId, 'lowStockAlert', payload);
};

module.exports = {
  initSocket,
  getIO,
  emitToUser,
  emitToAdmins,
  emitOrderStatusUpdated,
  emitLowStockAlert,
};
