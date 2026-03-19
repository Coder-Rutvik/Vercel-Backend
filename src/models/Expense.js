const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Expense = sequelize.define('Expense', {
  expenseId: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    field: 'expense_id'
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'e.g., salary, food_cost, electricity, maintenance'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  addedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Staff/Admin ID who added it',
    field: 'added_by_user_id'
  }
}, {
  tableName: 'expenses',
  timestamps: true
});

module.exports = Expense;
