const pg = require('pg'); // Force load pg for Vercel/Bundlers
const { Sequelize } = require('sequelize');
require('dotenv').config();

// Get database configuration
let sequelizeConfig = {};
let sequelize;

console.log('🔍 Checking Environment Variables...');
console.log('✅ Keys found:', Object.keys(process.env).filter(k => !k.includes('PASS') && !k.includes('SECRET')).join(', '));

if (process.env.DATABASE_URL) {
  console.log('🔌 DATABASE_URL detected. Connecting to Cloud DB...');

  sequelizeConfig = {
    dialect: 'postgres',
    dialectModule: pg, // Use pre-loaded pg
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ||
        process.env.PG_SSL === 'true' ||
        (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('ssl')) ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    define: {
      timestamps: true,
      underscored: true
    }
  };

  sequelize = new Sequelize(process.env.DATABASE_URL, sequelizeConfig);

} else {
  console.warn('⚠️ DATABASE_URL NOT FOUND (Check Vercel Settings). Falling back to localhost placeholders...');
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

  sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
      host: dbConfig.host,
      port: dbConfig.port,
      dialect: dbConfig.dialect,
      dialectModule: pg, // Use pre-loaded pg
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
            user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    return false;
  }
};

// Function to seed initial rooms
const seedRooms = async () => {
  try {
    const [roomsCount] = await sequelize.query('SELECT COUNT(*) FROM rooms');
    if (parseInt(roomsCount[0].count) > 0) {
      console.log('✅ Rooms already seeded');
      return;
    }

    console.log('🌱 Seeding initial rooms (101-110 pattern)...');
    let rooms = [];

    // Floors 1-9: 10 rooms each (e.g., 101-110)
    for (let floor = 1; floor <= 9; floor++) {
      for (let pos = 1; pos <= 10; pos++) {
        const roomNum = floor * 100 + pos;
        rooms.push(`(${roomNum}, ${floor}, ${pos}, 'standard', 'not-booked', 100.00)`);
      }
    }

    // Floor 10: 7 rooms (1001-1007)
    for (let pos = 1; pos <= 7; pos++) {
      const roomNum = 1000 + pos;
      rooms.push(`(${roomNum}, 10, ${pos}, 'standard', 'not-booked', 100.00)`);
    }

    const values = rooms.join(', ');
    await sequelize.query(`
      INSERT INTO rooms (room_number, floor, position, room_type, status, base_price) 
      VALUES ${values}
      ON CONFLICT (room_number) DO NOTHING;
    `);

    console.log('✅ 97 rooms seeded successfully (101-110 pattern)');
  } catch (error) {
    console.error('❌ Room seeding failed:', error.message);
  }
};

// Function to create all tables if missing
const setupDatabaseTables = async () => {
  try {
    console.log('🛠️ Setting up database tables...');

    // Enable UUID extension for Postgres
    await sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');

    await ensureUsersTable();

    let roomsCreated = false;
    try {
      await sequelize.query('SELECT 1 FROM rooms LIMIT 1');
      console.log('✅ Rooms table exists');
    } catch (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.log('📝 Creating rooms table...');
        await sequelize.query(`
          CREATE TABLE rooms (
            room_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
        roomsCreated = true;
      }
    }

    // Always check/seed rooms if table is empty
    await seedRooms();

    try {
      await sequelize.query('SELECT 1 FROM bookings LIMIT 1');
      console.log('✅ Bookings table exists');
    } catch (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.log('📝 Creating bookings table...');
        await sequelize.query(`
          CREATE TABLE bookings (
            booking_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL,
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
    return true;
  } catch (error) {
    console.error('❌ setupDatabaseTables failed:', error.message);
    return false;
  }
};

const connect = async () => {
  try {
    await sequelize.authenticate();
    await setupDatabaseTables();
    return sequelize;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    if (process.env.NODE_ENV === 'production') return null;
    throw error;
  }
};

const checkConnection = async () => {
  try {
    await sequelize.authenticate();
    return { connected: true, message: 'PostgreSQL connected successfully' };
  } catch (error) {
    return { connected: false, error: error.message };
  }
};

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

const close = async () => {
  try {
    await sequelize.close();
    return { closed: true };
  } catch (error) {
    return { closed: false, error: error.message };
  }
};

const closeAllConnections = async () => {
  const result = await close();
  return [{ db: 'PostgreSQL', status: result.closed ? 'closed' : 'error', error: result.error }];
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
  closeAllConnections
};