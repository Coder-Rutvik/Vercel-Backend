// src/models/index.js - FINAL SIMPLE VERSION
const { sequelize } = require('../config/database');

// Import models
const User = require('./User');
const Room = require('./Room');
const Booking = require('./Booking');

// Export everything
module.exports = {
  // Database instance
  sequelize,
  Sequelize: require('sequelize'),
  
  // Primary models (use these)
  User,
  Room,
  Booking,
  
  // For backward compatibility (older code might use these)
  UserPostgres: User,
  RoomPostgres: Room,
  BookingPostgres: Booking
};