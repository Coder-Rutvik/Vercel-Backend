// src/models/AuditLog.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'user_id'
  },
  action: {
    type: DataTypes.STRING(255),
    allowNull: false,
    comment: 'e.g., DELETE_BOOKING, UPDATE_BILL, ADD_INVENTORY'
  },
  details: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Previous state and new state or affected IDs'
  },
  ipAddress: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'ip_address'
  }
}, {
  tableName: 'audit_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false // We only need when it happened
});

module.exports = AuditLog;
