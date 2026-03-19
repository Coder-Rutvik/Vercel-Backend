// src/models/index.js - FINAL VERSION
const { sequelize } = require('../config/database');

// Import models
const User = require('./User');
const Room = require('./Room');
const Booking = require('./Booking');
const MenuItem = require('./MenuItem');
const Order = require('./Order');
const Expense = require('./Expense');
const Bill = require('./Bill');
const AuditLog = require('./AuditLog');
const InventoryItem = require('./InventoryItem');
const Vendor = require('./Vendor');
const PurchaseOrder = require('./PurchaseOrder');
const HousekeepingTask = require('./HousekeepingTask');

// Setup associations
User.hasMany(Booking, { foreignKey: 'userId', as: 'bookings' });
Booking.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Booking.hasMany(Order, { foreignKey: 'bookingId', as: 'orders' });
Order.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

Booking.hasOne(Bill, { foreignKey: 'bookingId', as: 'bill' });
Bill.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

User.hasMany(Expense, { foreignKey: 'addedBy', as: 'expenses' });

AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });
User.hasMany(AuditLog, { foreignKey: 'userId', as: 'auditLogs' });

Vendor.hasMany(PurchaseOrder, { foreignKey: 'vendorId', as: 'purchaseOrders' });
PurchaseOrder.belongsTo(Vendor, { foreignKey: 'vendorId', as: 'vendor' });

// Export everything
module.exports = {
  sequelize,
  Sequelize: require('sequelize'),
  
  User, Room, Booking, MenuItem, Order, Expense, Bill, AuditLog, InventoryItem, Vendor, PurchaseOrder, HousekeepingTask,
  
  UserPostgres: User,
  RoomPostgres: Room,
  BookingPostgres: Booking
};