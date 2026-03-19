const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Vendor = sequelize.define('Vendor', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  contactPerson: {
    type: DataTypes.STRING(100)
  },
  phone: {
    type: DataTypes.STRING(20)
  },
  email: {
    type: DataTypes.STRING(100)
  },
  suppliedItems: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Array of item names or IDs this vendor supplies'
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active'
  }
}, {
  tableName: 'vendors',
  timestamps: true
});

module.exports = Vendor;
