const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Bill = sequelize.define('Bill', {
  billId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    field: 'bill_id'
  },
  bookingId: {
    type: DataTypes.UUID,
    allowNull: false, // Tied to a room booking
    field: 'booking_id'
  },
  roomTotal: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'room_total'
  },
  foodTotal: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'food_total'
  },
  otherCharges: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'other_charges'
  },
  gstPercentage: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 18.00, // standard 18% GST typically
    field: 'gst_percentage'
  },
  taxAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'tax_amount'
  },
  grandTotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'grand_total'
  },
  paymentMode: {
    type: DataTypes.ENUM('cash', 'upi', 'card', 'pending'),
    defaultValue: 'pending',
    field: 'payment_mode'
  },
  isPaid: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_paid'
  }
}, {
  tableName: 'bills',
  timestamps: true
});

module.exports = Bill;
