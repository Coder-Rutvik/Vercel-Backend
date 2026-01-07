const { Sequelize } = require('sequelize');
require('dotenv').config();

// Enhanced PostgreSQL connection with better error handling
const getPostgresConnection = () => {
  if (!process.env.DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL not found. Using fallback configuration.');
    return new Sequelize(
      process.env.POSTGRES_DATABASE || 'hotel_reservation',
      process.env.POSTGRES_USER || 'postgres',
      process.env.POSTGRES_PASSWORD || '',
      {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000
        },
        dialectOptions: {
          ssl: process.env.NODE_ENV === 'production' ? {
            require: true,
            rejectUnauthorized: false
          } : false
        }
      }
    );
  }

  // Parse the DATABASE_URL for logging (masked) and decide SSL usage
  let maskedUrl = process.env.DATABASE_URL;
  // Allow explicit override via PG_SSL (set to 'true') or enable in production
  let shouldUseSsl = process.env.NODE_ENV === 'production' || process.env.PG_SSL === 'true';

  try {
    const urlObj = new URL(process.env.DATABASE_URL);
    maskedUrl = `postgresql://${urlObj.username || 'user'}:****@${urlObj.hostname || 'host'}:${urlObj.port || '5432'}${urlObj.pathname || ''}`;

    // Avoid forcing SSL for localhost unless explicitly requested
    if (!process.env.PG_SSL && (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1')) {
      shouldUseSsl = false;
    }
  } catch (e) {
    console.warn('⚠️ Could not parse DATABASE_URL for diagnostics:', e.message);
  }

  console.log(`🔗 Connecting to PostgreSQL: ${maskedUrl}`);

  return new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
      ssl: shouldUseSsl ? { require: true, rejectUnauthorized: false } : false,
      keepAlive: true,
      connectTimeout: 30000, // 30 seconds
      statement_timeout: 30000,
      query_timeout: 30000
    },
    pool: {
      max: 2, // Reduce for Render free tier
      min: 0,
      acquire: 60000,
      idle: 10000,
      evict: 10000
    },
    retry: {
      match: [
        /ConnectionError/,
        /SequelizeConnectionError/,
        /Connection terminated/,
        /ETIMEDOUT/,
        /ECONNRESET/,
        /ENOTFOUND/,
        /ENETUNREACH/,
        /ECONNREFUSED/
      ],
      max: 3,
      backoffBase: 1000,
      backoffExponent: 1.5
    },
    define: {
      timestamps: true,
      underscored: true
    }
  });
};

const sequelizePostgres = getPostgresConnection();

// Test connection with retry logic
const testConnection = async () => {
  let retries = 3;
  while (retries > 0) {
    try {
      await sequelizePostgres.authenticate();
      console.log('✅ PostgreSQL connection authenticated');
      
      // Test a simple query
      const [result] = await sequelizePostgres.query('SELECT version()');
      console.log('📊 PostgreSQL version:', result[0]?.version?.split(' ')[1] || 'Unknown');
      
      return true;
    } catch (error) {
      retries--;
      console.error(`❌ PostgreSQL connection failed. Retries left: ${retries}`, error.message);
      
      if (retries === 0) {
        console.error('❌ All PostgreSQL connection attempts failed');
        return false;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
};

// Auto-test connection only when host configuration looks valid
const isHostValid = () => {
  if (process.env.DATABASE_URL) return true;
  const host = process.env.POSTGRES_HOST || 'localhost';
  if (host === 'localhost') return true;
  // Consider host valid only if it's a fully-qualified domain (contains a dot)
  return host.includes('.');
};

if (process.env.NODE_ENV !== 'test' && isHostValid()) {
  testConnection().then(success => {
    if (!success && process.env.NODE_ENV === 'production') {
      console.warn('⚠️  PostgreSQL connection failed but continuing in production mode');
    }
  });
} else if (!isHostValid()) {
  console.warn('⚠️  Skipping automatic PostgreSQL connection test due to incomplete host configuration. Set `DATABASE_URL` or a fully qualified `POSTGRES_HOST` to enable it.');
}

module.exports = sequelizePostgres;