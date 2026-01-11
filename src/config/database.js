const pg = require('pg');
const { Sequelize } = require('sequelize');
require('dotenv').config();

const getSequelize = () => {
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️ DATABASE_URL not found, using local fallback...');
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

const connect = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ DB Connected');
    // Simple table check/creation can go here if needed
    return true;
  } catch (error) {
    console.error('❌ DB Connection Error:', error.message);
    return false;
  }
};

module.exports = { sequelize, connect };