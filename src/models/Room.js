const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Room = sequelize.define('Room', {
  roomId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    field: 'room_id'
  },
  roomNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    field: 'room_number'
  },
  floor: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  position: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  roomType: {
    type: DataTypes.STRING(20),
    defaultValue: 'standard',
    field: 'room_type'
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'not-booked',
    field: 'status'
  },
  basePrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 100.00,
    field: 'base_price'
  }
}, {
  tableName: 'rooms',
  timestamps: true,
  underscored: true
});

module.exports = Room;