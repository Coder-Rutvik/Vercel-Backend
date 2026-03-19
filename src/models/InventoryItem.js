// src/models/InventoryItem.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InventoryItem = sequelize.define('InventoryItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    comment: 'e.g., Rice, Chicken, Oil, Soap'
  },
  stockUnit: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'kg',
    comment: 'kg, litres, packets, pieces'
  },
  currentStock: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'current_stock'
  },
  lowStockThreshold: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 5,
    field: 'low_stock_threshold'
  }
}, {
  tableName: 'inventory_items',
  timestamps: true
});

module.exports = InventoryItem;
