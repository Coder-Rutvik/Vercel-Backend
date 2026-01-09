const { Sequelize } = require('sequelize');
require('dotenv').config();

// Database configuration
const dbConfig = {
  database: process.env.POSTGRES_DATABASE || 'hotel_reservation_db',
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'rutvik',
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
    ssl: false
  }
};

console.log('🔌 Connecting to PostgreSQL database...');
console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
console.log(`   Database: ${dbConfig.database}`);

// Initialize Sequelize
const sequelize = new Sequelize(
  dbConfig.database,
  dbConfig.username,
  dbConfig.password,
  {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: dbConfig.dialect,
    logging: dbConfig.logging,
    pool: dbConfig.pool,
    dialectOptions: dbConfig.dialectOptions,
    define: {
      timestamps: true,
      underscored: true
    }
  }
);

// Test the connection
const connect = async () => {
  let retries = 3;
  while (retries > 0) {
    try {
      await sequelize.authenticate();
      console.log('✅ PostgreSQL connected successfully');
      
      // Test a simple query
      const [result] = await sequelize.query('SELECT version()');
      console.log('📊 PostgreSQL version:', result[0]?.version?.split(' ')[1] || 'Unknown');
      
      return sequelize;
    } catch (error) {
      retries--;
      console.error(`❌ PostgreSQL connection failed. Retries left: ${retries}`, error.message);
      
      if (retries === 0) {
        console.error('❌ All PostgreSQL connection attempts failed');
        if (process.env.NODE_ENV === 'production') {
          console.warn('⚠️ Continuing in production without database connection (reduced functionality)');
          return null;
        }
        throw error;
      }
      
      // Wait for 2 seconds before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
};

// Check database connection status
const checkConnection = async () => {
  try {
    await sequelize.authenticate();
    return { connected: true };
  } catch (error) {
    return { 
      connected: false, 
      error: error.message,
      details: error
    };
  }
};

// Close all connections
const close = async () => {
  try {
    await sequelize.close();
    return { closed: true };
  } catch (error) {
    return { 
      closed: false, 
      error: error.message,
      details: error
    };
  }
};

// For backward compatibility
const checkAllConnections = checkConnection;
const closeAllConnections = async () => {
  const result = await close();
  return [{
    db: 'PostgreSQL',
    status: result.closed ? 'closed' : 'error',
    error: result.error
  }];
};

module.exports = {
  // New API
  sequelize,
  connect,
  checkConnection,
  close,
  
  // For backward compatibility
  postgresql: sequelize,
  sequelizePostgres: sequelize,
  checkAllConnections,
  closeAllConnections,
  
  // Deprecated
  getPostgresConnection: () => {
    console.warn('⚠️ getPostgresConnection() is deprecated. Use the exported sequelize instance directly.');
    return sequelize;
  }
};