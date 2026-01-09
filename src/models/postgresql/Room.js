const { DataTypes } = require('sequelize');
const { sequelizePostgres } = require('../../config/database');

const RoomPostgres = sequelizePostgres.define('Room', {
  roomId: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
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
    allowNull: false,
    comment: 'Position on floor (1-10 for floors 1-9, 1-7 for floor 10)'
  },
  roomType: {
    type: DataTypes.ENUM('standard', 'deluxe', 'suite'),
    defaultValue: 'standard',
    field: 'room_type'
  },
  isAvailable: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_available'
  },
  basePrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 100.00,
    field: 'base_price'
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  tableName: 'rooms',
  timestamps: true
});

module.exports = RoomPostgres;

