const EventEmitter = require('events');
const { emitToAdmins, emitToUser } = require('../sockets/socket');

class AppEvents extends EventEmitter {}
const appEvents = new AppEvents();

appEvents.EVENTS = {
  ORDER_PLACED: 'order-placed',
  STOCK_LOW: 'stock-low',
};

/*
 * order-placed payload: { orderId, customerId, totalAmount, itemCount, sellerIds: [] }
 * stock-low payload:    { productId, name, stock, sellerId }
 */

appEvents.on('order-placed', (payload) => {
  try {
    console.log(
      `[EVENT] order-placed -> order ${payload.orderId} | customer ${payload.customerId} | total ${payload.totalAmount}`
    );
    emitToAdmins('newOrder', payload);
    (payload.sellerIds || []).forEach((sellerId) => emitToUser(sellerId, 'newOrder', payload));
  } catch (err) {
    console.error('[EVENT] order-placed handler error:', err.message);
  }
});

appEvents.on('stock-low', (payload) => {
  try {
    console.warn(
      `[EVENT] stock-low -> product ${payload.productId} (${payload.name}) has only ${payload.stock} left`
    );
    emitToAdmins('lowStockAlert', payload);
    if (payload.sellerId) emitToUser(payload.sellerId, 'lowStockAlert', payload);
  } catch (err) {
    console.error('[EVENT] stock-low handler error:', err.message);
  }
});

module.exports = appEvents;
