const express = require('express');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

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

// SECURITY 1: Helmet for HTTP headers
app.use(helmet());

// SECURITY 2: Rate Limiting against Bruteforce / DDoS
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per `window` for demo scale
  message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});
// Apply basic rate limiting to all /api/ routes
app.use('/api/', limiter);

// Create Production Logging Stream
const accessLogStream = fs.createWriteStream(path.join(__dirname, '../logs', 'access.log'), { flags: 'a' });

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

// 3. Root Route (For quick health check)
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '🏨 Hotel Reservation System API (Vercel Ready)',
    timestamp: new Date().toISOString()
  });
});

// 4. DB Initialization Middleware (Lazy - runs on first request)
let dbInitialized = false;
app.use(async (req, res, next) => {
  if (!dbInitialized && req.path.startsWith('/api/')) {
    try {
      console.log('🔄 Initializing database...');
      const { connect } = require('./config/database');
      await connect();
      dbInitialized = true;
      console.log('✅ Database initialized');
    } catch (error) {
      console.error('❌ DB init failed:', error);
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
  app.use(morgan('combined', { stream: accessLogStream }));
  // Keep regular tiny output on console too
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
    const { checkAllConnections } = require('./config/database');
    const dbStatus = await checkAllConnections();
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

// NEW RESTAURANT ROUTE
const restaurantRoutes = require('./routes/restaurantRoutes');
app.use('/api/restaurant', restaurantRoutes);

// NEW BILLING ROUTE (ROOM + FOOD CHECKOUT)
const billingRoutes = require('./routes/billingRoutes');
app.use('/api/billing', billingRoutes);

// NEW ACCOUNTING/PNL ROUTE
const accountingRoutes = require('./routes/accountingRoutes');
app.use('/api/accounting', accountingRoutes);

// NEW INVENTORY & AUDIT LOG ROUTE
const inventoryRoutes = require('./routes/inventoryRoutes');
app.use('/api/inventory', inventoryRoutes);

// PHASE 3 PRO FEATURES
const proRoutes = require('./routes/proRoutes');
app.use('/api/pro', proRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Global error handler
app.use(errorHandler);

module.exports = app;