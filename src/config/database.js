const pg = require('pg');
const { Sequelize } = require('sequelize');
require('dotenv').config();

const getSequelize = () => {
  const dbUrl = process.env.DATABASE_URL ||
    `postgres://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DATABASE || 'hotel_db'}`;

  console.log('🔌 Connecting to DB:', dbUrl.replace(/:([^:@]+)@/, ':****@')); // Log masked URL

  return new Sequelize(dbUrl, {
    dialect: 'postgres',
    dialectModule: pg,
    logging: false,
    dialectOptions: (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')) ? {} : {
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
    const User = require('../models/User');
    const Room = require('../models/Room');
    const Booking = require('../models/Booking');

    // Sync all models (creates tables if they don't exist)
    // alter: false means it won't modify existing tables
    // Sync all models (creates tables if they don't exist, altars if they do)
    await sequelize.sync({ alter: true });
    console.log('✅ All models synced');

    // Seed rooms if table is empty
    const seedRooms = require('../utils/roomSeeder');
    await seedRooms();

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