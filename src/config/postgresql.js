const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelizePostgres = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      },
      keepAlive: true // Keep connections alive
    },
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    retry: {
      match: [
        /ConnectionError/,
        /SequelizeConnectionError/,
        /SequelizeConnectionTerminatedError/,
        /Connection terminated unexpectedly/
      ],
      max: 3
    }
  })
  : new Sequelize(
    process.env.POSTGRES_DATABASE || 'hotel_reservation',
    process.env.POSTGRES_USER || 'postgres',
    process.env.POSTGRES_PASSWORD || '',
    {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  );

module.exports = sequelizePostgres;

