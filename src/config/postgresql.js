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
      connectTimeout: 60000,
      statement_timeout: 30000,
      query_timeout: 30000,
      // Add idle timeout to prevent hanging connections
      idle_in_transaction_session_timeout: 30000
    },
    pool: {
      max: 5, // Render free tier can handle more
      min: 1, // Keep at least 1 connection alive
      acquire: 60000,
      idle: 20000, // Close idle connections after 20s
      evict: 10000,
      handleDisconnects: true,
      // Validate connection before using it
      validate: (client) => {
        return !client.connection._ending;
      }
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
        /Connection terminated unexpectedly/,
        /Connection terminated/,
        /ETIMEDOUT/,
        /ECONNRESET/,
        /ENOTFOUND/,
        /ENETUNREACH/,
        /ECONNREFUSED/,
        /timeout/i
      ],
      max: 3, // Reduced from 5 to fail faster
      backoffBase: 2000, // Start with 2 seconds
      backoffExponent: 1.5
    },
    define: {
      charset: 'utf8',
      collate: 'utf8_general_ci',
      timestamps: true,
      underscored: false
    },
    // Disable query queue to fail fast
    transactionType: 'IMMEDIATE',
    isolationLevel: 'READ_COMMITTED'
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

// Test connection with retry logic
const testConnection = async (retries = 3, delay = 5000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await sequelizePostgres.authenticate();
      console.log(`✅ PostgreSQL connection successful (attempt ${i + 1})`);
      return true;
    } catch (err) {
      console.error(`❌ PostgreSQL connection failed (attempt ${i + 1}/${retries}):`, err.message);
      if (i < retries - 1) {
        console.log(`⏳ Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  console.error('❌ PostgreSQL connection failed after all retries');
  return false;
};

// Test on startup if DATABASE_URL is provided
if (process.env.DATABASE_URL) {
  testConnection();
}

module.exports = sequelizePostgres;