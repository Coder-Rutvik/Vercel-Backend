const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PurchaseOrder = sequelize.define('PurchaseOrder', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  vendorId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'vendor_id'
  },
  items: {
    type: DataTypes.JSONB,
    allowNull: false,
    comment: 'Array of { itemName, quantity, price, unit }'
  },
  totalCost: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'total_cost'
  },
  status: {
    type: DataTypes.ENUM('pending', 'received', 'paid', 'cancelled'),
    defaultValue: 'pending'
  },
  orderDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'order_date'
  }
}, {
  tableName: 'purchase_orders',
  timestamps: true
});

module.exports = PurchaseOrder;
