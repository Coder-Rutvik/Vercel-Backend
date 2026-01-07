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

// Log DATABASE_URL format (without password)
if (process.env.DATABASE_URL) {
  const urlWithoutPassword = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@');
  console.log('📊 DATABASE_URL format:', urlWithoutPassword);
}

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
      console.log('🔄 Attempting PostgreSQL connection...');
      await sequelizePostgres.authenticate();
      console.log('✅ PostgreSQL connected successfully');

      // Sync tables - IMPORTANT: Create tables if they don't exist
      console.log('🔄 Syncing PostgreSQL tables...');
      const { sequelizePostgres: seqPg } = require('./src/models/postgresql');
      
      // Use alter: true to update schema without dropping data
      await seqPg.sync({ alter: true });
      console.log('✅ PostgreSQL tables synced successfully');
      
      // Verify tables exist
      const [results] = await seqPg.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
      console.log('📋 Available tables:', results.map(r => r.table_name).join(', '));
      
    } catch (postgresError) {
      console.error('❌ PostgreSQL error:', postgresError.message);
      console.error('Stack:', postgresError.stack);
      
      // Don't exit, but log the issue
      console.log('⚠️  Continuing without PostgreSQL...');
    }

    // Connect to MongoDB (Optional)
    try {
      await connectMongoDB();
      console.log('✅ MongoDB connected successfully');
    } catch (mongoError) {
      console.warn('⚠️  MongoDB connection failed (continuing without):', mongoError.message);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🐘 PostgreSQL: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}`);
      console.log(`📊 MongoDB: ${process.env.MONGODB_URI ? 'Configured' : 'Not configured'}`);
      console.log('===========================================');
      console.log('🎉 Backend ready on Render!');
      console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
  console.error('Stack:', err.stack);
  // Don't exit in production, just log
  if (process.env.NODE_ENV !== 'production') {
    process.exit(1);
  }
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  console.error('Stack:', err.stack);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received. Shutting down gracefully...');
  try {
    await sequelizePostgres.close();
    console.log('✅ Database connections closed');
  } catch (error) {
    console.error('❌ Error closing connections:', error);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 SIGINT received. Shutting down gracefully...');
  try {
    await sequelizePostgres.close();
    console.log('✅ Database connections closed');
  } catch (error) {
    console.error('❌ Error closing connections:', error);
  }
  process.exit(0);
});

startServer();