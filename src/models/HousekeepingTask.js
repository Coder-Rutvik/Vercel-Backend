const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const HousekeepingTask = sequelize.define('HousekeepingTask', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  roomNumber: { type: DataTypes.INTEGER, allowNull: false, field: 'room_number' },
  status: { type: DataTypes.ENUM('dirty', 'cleaning', 'cleaned', 'inspected'), defaultValue: 'dirty' },
  assignedTo: { type: DataTypes.UUID, allowNull: true, field: 'assigned_to_user_id', comment: 'Staff member ID' },
  priority: { type: DataTypes.ENUM('low', 'normal', 'high', 'urgent'), defaultValue: 'normal' }
}, {
  tableName: 'housekeeping_tasks',
  timestamps: true
});

module.exports = HousekeepingTask;
