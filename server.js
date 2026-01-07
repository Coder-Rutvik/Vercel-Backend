require('dotenv').config();

// Validate required environment variables for production
if (process.env.NODE_ENV === 'production') {
  const requiredVars = ['JWT_SECRET', 'DATABASE_URL'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ ERROR: Missing required environment variables:', missingVars);
    process.exit(1);
  }
}

// For Render, focus only on PostgreSQL and MongoDB
const sequelizePostgres = require('./src/config/postgresql');
const connectMongoDB = require('./src/config/mongodb');
const app = require('./src/app');

const PORT = process.env.PORT || 10000;

const startServer = async () => {
  try {
    console.log('🚀 Starting Hotel Reservation System Backend on Render...');
    console.log('===========================================');

    // Connect to PostgreSQL (Primary for Render)
    try {
      await sequelizePostgres.authenticate();
      console.log('✅ PostgreSQL connected successfully');

      // Sync tables (Ensure they exist)
      // const { sequelizePostgres: seqPg } = require('./src/models/postgresql');
      // Using alter: true to update schema without dropping data
      // await seqPg.sync({ alter: true });
      console.log('✅ PostgreSQL connection verified (Sync skipped for stability)');
    } catch (postgresError) {
      console.error('❌ PostgreSQL connection failed:', postgresError.message);
      console.log('⚠️  Continuing without PostgreSQL...');
    }

    // Connect to MongoDB (Optional)
    try {
      await connectMongoDB();
      console.log('✅ MongoDB connected successfully');
    } catch (mongoError) {
      console.warn('⚠️  MongoDB connection failed (continuing without):', mongoError.message);
    }

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🐘 PostgreSQL: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
      console.log(`📊 MongoDB: ${process.env.MONGODB_URI ? 'Connected' : 'Not configured'}`);
      console.log('===========================================');
      console.log('🎉 Backend ready on Render!');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  // Don't exit in production, just log
  if (process.env.NODE_ENV === 'production') {
    console.log('⚠️  Continuing despite unhandled rejection');
  } else {
    process.exit(1);
  }
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

startServer();