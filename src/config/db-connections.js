// Centralized database connections export
// Use this to access all database connections from anywhere in the project

const mysql = require('./mysql');
const postgresql = require('./postgresql');
const connectMongoDB = require('./mongodb');
const mongoose = require('mongoose');

module.exports = {
  mysql,
  postgresql,
  mongodb: mongoose.connection,
  connectMongoDB,

  // Helper function to check all connections
  async checkAllConnections() {
    const status = {
      mysql: { connected: false, error: null },
      postgresql: { connected: false, error: null },
      mongodb: { connected: false, error: null }
    };

    try {
      await mysql.authenticate();
      status.mysql.connected = true;
    } catch (error) {
      console.error('MySQL connection check failed:', error.message);
      status.mysql.error = error.message;
    }

    try {
      await postgresql.authenticate();
      status.postgresql.connected = true;
    } catch (error) {
      console.error('PostgreSQL connection check failed:', error.message);
      status.postgresql.error = error.message;
    }

    try {
      status.mongodb.connected = mongoose.connection.readyState === 1;
      if (!status.mongodb.connected) {
        status.mongodb.error = `State: ${mongoose.connection.readyState}`;
      }
    } catch (error) {
      console.error('MongoDB connection check failed:', error.message);
      status.mongodb.error = error.message;
    }

    return status;
  }
};

