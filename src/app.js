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
// Security middleware - Simplified for Vercel
// app.use(helmet()); // Helmet can conflict with Vercel headers
app.use(compression());

// CORS configuration - ROBUST SETUP
const corsOptions = {
  origin: '*', // Allow all origins explicitly
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes

// Fallback: Hand-crafted headers just in case
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  next();
});

// Rate limiting - Commented out for Vercel serverless (stateless)
/*
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path === '/api/health';
  }
});
app.use('/api/', limiter);
*/

// Request logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  // Use 'tiny' for production to reduce log volume
  app.use(morgan('tiny'));
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
        resetAll: 'POST /api/rooms/reset-all (PRIVATE)'
      },
      bookings: {
        create: 'POST /api/bookings',
        myBookings: 'GET /api/bookings/my-bookings'
      }
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
  const { sequelize } = require('./config/database');
  try {
    const [result] = await sequelize.query('SELECT 1+1 AS result');
    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error('DB test failed:', err && err.message);
    res.status(500).json({ success: false, error: err.message, code: err.code });
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
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use(errorHandler);

module.exports = app;