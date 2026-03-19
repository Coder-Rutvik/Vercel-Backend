const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MenuItem = sequelize.define('MenuItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'e.g., Indian, Chinese, Italian, Drinks'
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_available'
  },
  type: {
    type: DataTypes.ENUM('veg', 'non-veg'),
    defaultValue: 'veg'
  }
}, {
  tableName: 'menu_items',
  timestamps: true
});

module.exports = MenuItem;
