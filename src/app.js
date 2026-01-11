const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');

// Import routes
const authRoutes = require('./routes/authRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const roomRoutes = require('./routes/roomRoutes');
const adminRoutes = require('./routes/adminRoutes');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

// DB connections (Postgres-only)
const dbConnections = require('./config/database');

const app = express();

// 1. TRUST PROXY
app.set('trust proxy', 1);

// 2. CORS - MUST BE FIRST
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// 3. DB Initialization Middleware (Runs once)
let isDbInitialized = false;
app.use(async (req, res, next) => {
  if (!isDbInitialized && req.path !== '/api/health') {
    try {
      console.log('🔄 First request detected. Initializing database...');
      const { connect } = require('./config/database');
      await connect();
      isDbInitialized = true;
      console.log('✅ Database ready');
    } catch (err) {
      console.error('❌ Database boot failed:', err.message);
    }
  }
  next();
});

// 4. Other Middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('tiny'));
}

// ✅ ROOT ENDPOINT
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏨 Hotel Reservation System API (Vercel Ready)',
    version: '1.2.0'
  });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbStatus = await dbConnections.checkAllConnections();
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      databases: {
        postgresql: dbStatus.postgresql.connected ? 'connected' : `disconnected (${dbStatus.postgresql.error})`
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Global error handler
app.use(errorHandler);

module.exports = app;