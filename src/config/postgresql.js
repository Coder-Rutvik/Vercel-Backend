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
      keepAlive: true,
      // Add connection timeout
      connectTimeout: 60000,
      // Statement timeout (30 seconds)
      statement_timeout: 30000,
      // Query timeout
      query_timeout: 30000
    },
    pool: {
      max: 3, // Reduced for free tier
      min: 0,
      acquire: 60000, // Increased to 60 seconds
      idle: 30000, // Keep connection alive for 30 seconds
      evict: 5000,
      // Handle connection errors gracefully
      handleDisconnects: true
    },
    retry: {
      match: [
        /ConnectionError/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
        /SequelizeConnectionTerminatedError/,
        /Connection terminated unexpectedly/,
        /Connection terminated/,
        /ETIMEDOUT/,
        /ECONNRESET/,
        /ENOTFOUND/,
        /ENETUNREACH/,
        /ECONNREFUSED/
      ],
      max: 5, // Retry 5 times
      backoffBase: 1000, // Start with 1 second
      backoffExponent: 1.5 // Exponential backoff
    },
    // Add query timeout
    define: {
      charset: 'utf8',
      collate: 'utf8_general_ci'
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

// Test connection on startup
if (process.env.DATABASE_URL) {
  sequelizePostgres.authenticate()
    .then(() => {
      console.log('✅ PostgreSQL initial connection successful');
    })
    .catch(err => {
      console.error('❌ PostgreSQL initial connection failed:', err.message);
    });
}

// Handle pool errors (guarded for different Sequelize versions)
const pgPool = (sequelizePostgres.connectionManager && sequelizePostgres.connectionManager.pool) || sequelizePostgres.pool;
if (pgPool && typeof pgPool.on === 'function') {
  pgPool.on('error', (err) => {
    console.error('❌ PostgreSQL pool error:', err);
  });
} else {
  console.warn('⚠️ PostgreSQL pool not available; skipping pool error handler.');
}

module.exports = sequelizePostgres;