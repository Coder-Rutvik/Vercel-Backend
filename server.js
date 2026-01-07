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

// Helper: retry connection attempts with exponential backoff
async function tryConnectWithRetry(sequelize, name, maxAttempts = 5) {
  let attempt = 0;
  let lastErr = null;
  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      console.log(`Attempt ${attempt} to connect to ${name}...`);
      await sequelize.authenticate();
      console.log(`✅ ${name} connected successfully`);
      return true;
    } catch (err) {
      lastErr = err;
      console.error(`Attempt ${attempt} failed:`, err.message);
      if (attempt < maxAttempts) {
        const delay = Math.min(30000, 1000 * Math.pow(2, attempt));
        console.log(`Waiting ${delay}ms before retrying ${name}...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.error(`Register error: ${err.name}: ${err.message}`);
      }
    }
  }
  return false;
}

const startServer = async () => {
  try {
    console.log('🚀 Starting Hotel Reservation System Backend on Render...');
    console.log('===========================================');

    // Start listening immediately so Render detects the open port
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('===========================================');
      console.log('🎉 Backend is starting (DB initialization will run in background)');
      console.log(`🌐 Health check: http://localhost:${PORT}/api/health`);
    });

    // Initialize databases asynchronously (won't block the server)
    (async function initDatabases() {
      // PostgreSQL (primary)
      try {
        console.log('🔄 Attempting PostgreSQL connection...');
        const { sequelizePostgres: seqPg } = require('./src/models/postgresql');
        const connected = await tryConnectWithRetry(seqPg, 'PostgreSQL', 5);
        if (connected) {
          console.log('🔄 Syncing PostgreSQL tables...');
          try {
            await seqPg.sync({ alter: true });
            console.log('✅ PostgreSQL tables synced successfully');
            try {
              const [results] = await seqPg.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
              `);
              console.log('📋 Available tables:', results.map(r => r.table_name).join(', '));
            } catch (qerr) {
              console.warn('⚠️ Could not list PostgreSQL tables:', qerr.message);
            }
          } catch (syncErr) {
            console.error('❌ PostgreSQL sync error:', syncErr.message);
          }
        } else {
          console.log('⚠️  Continuing without PostgreSQL...');
        }
      } catch (postgresError) {
        console.error('❌ PostgreSQL error during init:', postgresError.message);
      }

      // MongoDB (optional)
      try {
        await connectMongoDB();
        console.log('✅ MongoDB connected successfully');
      } catch (mongoError) {
        console.warn('⚠️  MongoDB connection failed (continuing without):', mongoError.message);
      }
    })();

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