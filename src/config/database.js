const { Sequelize } = require('sequelize');
require('dotenv').config();

// Get database configuration from DATABASE_URL or individual variables
let sequelizeConfig = {};
let sequelize; // Declare here at the top

if (process.env.DATABASE_URL) {
  console.log('🔌 Using DATABASE_URL for PostgreSQL connection...');

  const isRender = process.env.DATABASE_URL.includes('render.com');

  sequelizeConfig = {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      ssl: isRender || process.env.PG_SSL === 'true' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    define: {
      timestamps: true,
      underscored: true
    }
  };

  sequelize = new Sequelize(process.env.DATABASE_URL, sequelizeConfig); // Remove var

} else {
  console.log('🔌 Using individual environment variables for PostgreSQL connection...');
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
    }
  };

  console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
  console.log(`   Database: ${dbConfig.database}`);

  sequelize = new Sequelize( // Remove var
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
      host: dbConfig.host,
      port: dbConfig.port,
      dialect: dbConfig.dialect,
      logging: dbConfig.logging,
      pool: dbConfig.pool,
      define: {
        timestamps: true,
        underscored: true
      }
    }
  );
}

// Function to ensure users table exists
const ensureUsersTable = async () => {
  try {
    console.log('🔍 Checking if users table exists...');

    try {
      await sequelize.query('SELECT 1 FROM users LIMIT 1');
      console.log('✅ Users table exists');
      return true;
    } catch (queryError) {
      if (queryError.message.includes('does not exist') || queryError.code === '42P01') {
        console.log('📝 Users table not found. Creating...');

        const createTableSQL = `
          CREATE TABLE users (
            user_id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            email VARCHAR(100) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            phone VARCHAR(20),
            role VARCHAR(10) DEFAULT 'user',
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE INDEX idx_users_email ON users(email);
        `;

        await sequelize.query(createTableSQL);
        console.log('✅ Users table created successfully');
        return true;
      }
      throw queryError;
    }
  } catch (error) {
    console.error('❌ ensureUsersTable failed:', error.message);

    try {
      console.log('🔄 Trying simple table creation...');
      const simpleSQL = `
        CREATE TABLE IF NOT EXISTS users (
          user_id SERIAL PRIMARY KEY,
          name TEXT,
          email TEXT UNIQUE,
          password TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      await sequelize.query(simpleSQL);
      console.log('✅ Simple users table created');
      return true;
    } catch (simpleError) {
      console.error('❌ Simple creation also failed:', simpleError.message);
      return false;
    }
  }
};

// Function to create all tables if missing
const setupDatabaseTables = async () => {
  try {
    console.log('🛠️ Setting up database tables...');

    await ensureUsersTable();

    try {
      await sequelize.query('SELECT 1 FROM rooms LIMIT 1');
      console.log('✅ Rooms table exists');
    } catch (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.log('📝 Creating rooms table...');
        await sequelize.query(`
          CREATE TABLE rooms (
            room_id SERIAL PRIMARY KEY,
            room_number INTEGER UNIQUE NOT NULL,
            floor INTEGER NOT NULL,
            position INTEGER NOT NULL,
            room_type VARCHAR(20) DEFAULT 'standard',
            status VARCHAR(20) DEFAULT 'not-booked',
            base_price DECIMAL(10,2) DEFAULT 100.00,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        console.log('✅ Rooms table created');
      }
    }

    try {
      await sequelize.query('SELECT 1 FROM bookings LIMIT 1');
      console.log('✅ Bookings table exists');
    } catch (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.log('📝 Creating bookings table...');
        await sequelize.query(`
          CREATE TABLE bookings (
            booking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id INTEGER NOT NULL,
            rooms JSONB NOT NULL,
            total_rooms INTEGER NOT NULL,
            travel_time INTEGER NOT NULL,
            total_price DECIMAL(10,2) NOT NULL,
            booking_date DATE DEFAULT CURRENT_DATE,
            check_in_date DATE NOT NULL,
            check_out_date DATE NOT NULL,
            status VARCHAR(20) DEFAULT 'confirmed',
            payment_status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(user_id)
          )
        `);
        console.log('✅ Bookings table created');
      }
    }

    console.log('🎉 All database tables setup complete');
    return true;
  } catch (error) {
    console.error('❌ setupDatabaseTables failed:', error.message);
    return false;
  }
};

// Test the connection
const connect = async () => {
  let retries = 3;
  while (retries > 0) {
    try {
      await sequelize.authenticate();
      console.log('✅ PostgreSQL connected successfully');

      await setupDatabaseTables();

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

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
};

// Check database connection status
const checkConnection = async () => {
  try {
    await sequelize.authenticate();

    return {
      connected: true,
      message: 'PostgreSQL connected successfully'
    };
  } catch (error) {
    console.error('❌ PostgreSQL connection check failed:', error.message);
    return {
      connected: false,
      error: error.message
    };
  }
};

// For backward compatibility
const checkAllConnections = async () => {
  const status = await checkConnection();

  return {
    postgresql: {
      connected: status.connected,
      error: status.error || undefined,
      message: status.message
    }
  };
};

// Close all connections
const close = async () => {
  try {
    await sequelize.close();
    return { closed: true };
  } catch (error) {
    return {
      closed: false,
      error: error.message
    };
  }
};

const closeAllConnections = async () => {
  const result = await close();
  return [{
    db: 'PostgreSQL',
    status: result.closed ? 'closed' : 'error',
    error: result.error
  }];
};

module.exports = {
  sequelize,
  connect,
  checkConnection,
  close,
  ensureUsersTable,
  setupDatabaseTables,

  postgresql: sequelize,
  sequelizePostgres: sequelize,

  checkAllConnections,
  closeAllConnections,

  getPostgresConnection: () => {
    console.warn('⚠️ getPostgresConnection() is deprecated. Use the exported sequelize instance directly.');
    return sequelize;
  }
};