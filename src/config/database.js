const pg = require('pg');
const { Sequelize } = require('sequelize');
require('dotenv').config();

const getSequelize = () => {
  if (!process.env.DATABASE_URL) {
    return new Sequelize('postgres://postgres:postgres@localhost:5432/hotel_db', {
      dialect: 'postgres',
      dialectModule: pg,
      logging: false
    });
  }

  return new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    dialectModule: pg,
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
  });
};

const sequelize = getSequelize();

const checkConnection = async () => {
  try {
    await sequelize.authenticate();
    return { connected: true };
  } catch (error) {
    return { connected: false, error: error.message };
  }
};

const checkAllConnections = async () => {
  const status = await checkConnection();
  return {
    postgresql: {
      connected: status.connected,
      error: status.error
    }
  };
};

const connect = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ DB Connected');

    // Import all models to ensure they're registered
    require('../models/User');
    require('../models/Room');
    require('../models/Booking');

    // Sync all models (creates tables if they don't exist)
    // alter: false means it won't modify existing tables
    await sequelize.sync({ alter: false });
    console.log('✅ All models synced');

    return true;
  } catch (error) {
    console.error('❌ DB Connection Error:', error.message);
    return false;
  }
};

module.exports = {
  sequelize,
  connect,
  checkConnection,
  checkAllConnections
};