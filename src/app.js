const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');

// Import routes
const authRoutes = require('./routes/authRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const roomRoutes = require('./routes/roomRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const loggerMiddleware = require('./middleware/logger');

// DB connections (Postgres-only)
const dbConnections = require('./config/database');

const app = express();

app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
app.use(cors({
  origin: true, // Allow all origins (dynamically reflects request origin)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept']
}));

// Rate limiting - FIXED for Render
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  }
});

app.use('/api/', limiter);

// Request logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Custom logger middleware (Postgres-only setup)
app.use(loggerMiddleware);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✅ ROOT ENDPOINT
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏨 Hotel Reservation System API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      dbTest: 'GET /api/db-test',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        profile: 'GET /api/auth/me'
      },
      rooms: {
        all: 'GET /api/rooms',
        available: 'GET /api/rooms/available',
        byFloor: 'GET /api/rooms/floor/:floorNumber',
        seedRooms: 'POST /api/rooms/seed-rooms (PRIVATE)',
        resetAll: 'POST /api/rooms/reset-all (PRIVATE)'
      },
      bookings: {
        create: 'POST /api/bookings',
        myBookings: 'GET /api/bookings/my-bookings'
      }
    },
    emergencyFixes: {
      autoCreateRooms: 'POST /api/auto-fix-rooms',
      forceCreateRooms: 'POST /api/force-create-rooms'
    }
  });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = await dbConnections.checkAllConnections();

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'Hotel Reservation API - Unstop Assessment',
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      databases: {
        postgresql: dbStatus.postgresql.connected ? 'connected' : `disconnected (${dbStatus.postgresql.error})`
      },
      endpoints: {
        auth: '/api/auth',
        bookings: '/api/bookings',
        rooms: '/api/rooms',
        admin: '/api/admin',
        dbTest: '/api/db-test'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

// DB diagnostic endpoint
app.get('/api/db-test', async (req, res) => {
  const { sequelizePostgres } = require('./config/database');
  try {
    const [result] = await sequelizePostgres.query('SELECT 1+1 AS result');
    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error('DB test failed:', err && err.message);
    res.status(500).json({ success: false, error: err.message, code: err.code });
  }
});

// ✅ EMERGENCY FIX 1: Auto-create rooms
app.post('/api/auto-fix-rooms', async (req, res) => {
  try {
    const { sequelize } = require('./config/database');
    
    console.log('🔄 AUTO-FIX: Checking and creating rooms...');
    
    // 1. Check if rooms table exists
    const [tables] = await sequelize.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'rooms'
      ) as table_exists
    `);
    
    let message = '';
    
    if (!tables[0].table_exists) {
      console.log('📝 Creating rooms table...');
      await sequelize.query(`
        CREATE TABLE rooms (
          room_id SERIAL PRIMARY KEY,
          room_number INTEGER UNIQUE NOT NULL,
          floor INTEGER NOT NULL,
          position INTEGER NOT NULL,
          room_type VARCHAR(20) DEFAULT 'standard',
          is_available BOOLEAN DEFAULT true,
          base_price DECIMAL(10,2) DEFAULT 100.00,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      message += 'Created rooms table. ';
    }
    
    // 2. Check room count
    const [roomCount] = await sequelize.query('SELECT COUNT(*) FROM rooms');
    const count = parseInt(roomCount[0].count);
    
    if (count === 0) {
      console.log('🏨 Adding 20 sample rooms...');
      
      // Add 20 sample rooms
      const sampleRooms = [
        [101, 1, 1, 'standard', true, 100.00],
        [102, 1, 2, 'standard', true, 100.00],
        [103, 1, 3, 'standard', true, 100.00],
        [104, 1, 4, 'standard', true, 100.00],
        [105, 1, 5, 'standard', true, 100.00],
        [106, 1, 6, 'standard', true, 100.00],
        [107, 1, 7, 'standard', true, 100.00],
        [108, 1, 8, 'deluxe', true, 150.00],
        [109, 1, 9, 'deluxe', true, 150.00],
        [110, 1, 10, 'deluxe', true, 150.00],
        [201, 2, 1, 'standard', true, 100.00],
        [202, 2, 2, 'standard', true, 100.00],
        [203, 2, 3, 'standard', true, 100.00],
        [204, 2, 4, 'standard', true, 100.00],
        [205, 2, 5, 'standard', true, 100.00],
        [206, 2, 6, 'standard', true, 100.00],
        [207, 2, 7, 'standard', true, 100.00],
        [208, 2, 8, 'standard', true, 100.00],
        [209, 2, 9, 'standard', true, 100.00],
        [210, 2, 10, 'standard', true, 100.00]
      ];
      
      for (const room of sampleRooms) {
        await sequelize.query(`
          INSERT INTO rooms (room_number, floor, position, room_type, is_available, base_price)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (room_number) DO NOTHING
        `, room);
      }
      
      message += 'Added 20 sample rooms. ';
    }
    
    // 3. Final count
    const [finalCount] = await sequelize.query('SELECT COUNT(*) FROM rooms');
    const [availableCount] = await sequelize.query('SELECT COUNT(*) FROM rooms WHERE is_available = true');
    
    res.json({
      success: true,
      message: message || 'Rooms already exist',
      rooms: {
        total: parseInt(finalCount[0].count),
        available: parseInt(availableCount[0].count)
      },
      nextStep: 'Now try: GET /api/rooms or POST /api/bookings'
    });
    
  } catch (error) {
    console.error('Auto-fix error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      sql: error.sql
    });
  }
});

// ✅ EMERGENCY FIX 2: Force create rooms (destructive)
app.post('/api/force-create-rooms', async (req, res) => {
  try {
    const { sequelize } = require('./config/database');
    
    console.log('💥 FORCE CREATING ROOMS...');
    
    // 1. Drop and recreate table
    await sequelize.query('DROP TABLE IF EXISTS rooms CASCADE');
    
    await sequelize.query(`
      CREATE TABLE rooms (
        room_id SERIAL PRIMARY KEY,
        room_number INTEGER UNIQUE NOT NULL,
        floor INTEGER NOT NULL,
        position INTEGER NOT NULL,
        room_type VARCHAR(20) DEFAULT 'standard',
        is_available BOOLEAN DEFAULT true,
        base_price DECIMAL(10,2) DEFAULT 100.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // 2. Add 97 rooms as per specification
    const rooms = [];
    
    // Floors 1-9: 10 rooms each
    for (let floor = 1; floor <= 9; floor++) {
      for (let position = 1; position <= 10; position++) {
        const roomNumber = (floor * 100) + position;
        rooms.push({
          room_number: roomNumber,
          floor: floor,
          position: position,
          room_type: floor >= 8 ? 'deluxe' : 'standard',
          is_available: true,
          base_price: floor >= 8 ? 150.00 : 100.00
        });
      }
    }
    
    // Floor 10: 7 rooms
    for (let position = 1; position <= 7; position++) {
      const roomNumber = 1000 + position;
      rooms.push({
        room_number: roomNumber,
        floor: 10,
        position: position,
        room_type: 'suite',
        is_available: true,
        base_price: 200.00
      });
    }
    
    // 3. Insert all rooms
    for (const room of rooms) {
      await sequelize.query(`
        INSERT INTO rooms (room_number, floor, position, room_type, is_available, base_price)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [room.room_number, room.floor, room.position, room.room_type, room.is_available, room.base_price]);
    }
    
    const [count] = await sequelize.query('SELECT COUNT(*) FROM rooms');
    
    res.json({
      success: true,
      message: `FORCE CREATED ${rooms.length} ROOMS SUCCESSFULLY`,
      rooms: {
        total: parseInt(count[0].count),
        floors: '1-10',
        specification: 'Floors 1-9: 10 rooms each, Floor 10: 7 rooms'
      },
      action: 'APPLICATION IS NOW 100% READY FOR BOOKINGS!'
    });
    
  } catch (error) {
    console.error('Force create error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      'GET    /',
      'GET    /api/health',
      'GET    /api/db-test',
      'POST   /api/auto-fix-rooms (EMERGENCY)',
      'POST   /api/force-create-rooms (EMERGENCY)',
      'POST   /api/auth/register',
      'POST   /api/auth/login',
      'GET    /api/auth/me',
      'GET    /api/rooms',
      'GET    /api/rooms/available',
      'POST   /api/bookings',
      'GET    /api/bookings/my-bookings',
      'GET    /api/admin/stats (admin only)'
    ]
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;