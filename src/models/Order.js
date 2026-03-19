const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./User');
const Booking = require('./Booking');

const Order = sequelize.define('Order', {
  orderId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    field: 'order_id'
  },
  bookingId: {
    type: DataTypes.UUID,
    allowNull: true, // Can be unlinked if walking customer
    field: 'booking_id'
  },
  tableNumber: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'table_number'
  },
  items: {
    type: DataTypes.JSONB,
    allowNull: false,
    comment: 'Array of { menuItemId, name, quantity, price }'
  },
  totalPrice: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'total_price'
  },
  status: {
    type: DataTypes.ENUM('pending', 'preparing', 'prepared', 'delivered', 'cancelled'),
    defaultValue: 'pending'
  },
  paymentStatus: {
    type: DataTypes.ENUM('unpaid', 'paid', 'added-to-room'),
    defaultValue: 'unpaid',
    field: 'payment_status'
  }
}, {
  tableName: 'orders',
  timestamps: true
});

module.exports = Order;
