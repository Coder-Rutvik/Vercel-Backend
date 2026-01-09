require('dotenv').config();

console.log('🚀 Starting Hotel Reservation System Backend...');
console.log('===========================================');

// Log environment (mask sensitive info)
console.log('📊 Environment:', process.env.NODE_ENV || 'development');
console.log('🔧 Port:', process.env.PORT || 5000);

// Warn if the web server PORT is mistakenly set to the PostgreSQL default (5432)
if (process.env.PORT === '5432') {
  console.warn('⚠️ Environment variable PORT is set to 5432 (Postgres default). On Render the platform sets the PORT for the web service — unset this to avoid conflicts and allow Render to assign the correct port.');
}

console.log('🌐 CORS Origin:', process.env.CORS_ORIGIN || 'Not set');

// Log database URLs (masked for security)
if (process.env.DATABASE_URL) {
  const maskedPgUrl = process.env.DATABASE_URL
    .replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
  console.log('📊 PostgreSQL URL:', maskedPgUrl);
}

// Validate required environment variables for production
if (process.env.NODE_ENV === 'production') {
  const requiredVars = ['JWT_SECRET', 'DATABASE_URL'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    console.error('❌ ERROR: Missing required environment variables:', missingVars);
    console.error('💡 Please set these in your Render dashboard environment variables');
    process.exit(1);
  }
}

const app = require('./src/app');

const PORT = process.env.PORT || 5000;

// Retry connection function with exponential backoff
async function retryConnection(fn, name, maxAttempts = 3, baseDelay = 2000) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔄 [${name}] Attempt ${attempt}/${maxAttempts}...`);
      await fn();
      console.log(`✅ [${name}] Connected successfully`);
      return true;
    } catch (error) {
      lastError = error;
      console.error(`❌ [${name}] Attempt ${attempt} failed:`, error.message);

      if (attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`⏳ [${name}] Waiting ${delay}ms before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`❌ [${name}] All ${maxAttempts} attempts failed`);
  return false;
}

// Initialize databases asynchronously (won't block server startup)
async function initializeDatabases() {
  console.log('\n🔄 Initializing databases...');

  // PostgreSQL (Primary - Required)
  try {
    // Fail-fast in production when DATABASE_URL/POSTGRES_HOST points to localhost
    if (process.env.NODE_ENV === 'production') {
      let dbHost = null;
      try {
        if (process.env.DATABASE_URL) {
          dbHost = new URL(process.env.DATABASE_URL).hostname;
        } else {
          dbHost = process.env.POSTGRES_HOST;
        }
      } catch (e) {
        dbHost = null;
      }

      if (!dbHost || dbHost === 'localhost' || dbHost === '127.0.0.1') {
        console.error('❌ FATAL: DATABASE_URL points to localhost or is not set while NODE_ENV=production.');
        console.error('💡 Please set the managed Postgres `DATABASE_URL` in your Render service environment variables and set `PG_SSL=true` if required.');
        // Exit early so deployments fail fast and you can fix environment variables in Render
        process.exit(1);
      }
    }

    const { sequelizePostgres } = require('./src/config/database');

    // Diagnostic: log host from DATABASE_URL if present, and validate
    let pgHost = 'localhost';
    if (process.env.DATABASE_URL) {
      try {
        pgHost = new URL(process.env.DATABASE_URL).hostname;
        console.log(`🔗 PostgreSQL host: ${pgHost}`);
      } catch (e) {
        console.log('🔗 PostgreSQL host: (could not parse DATABASE_URL)');
      }
    } else {
      pgHost = process.env.POSTGRES_HOST || 'localhost';
      console.log(`🔗 PostgreSQL host: ${pgHost}`);
    }

    // If the host looks incomplete (no dot and not localhost), warn and skip retries
    let skipPostgres = false;
    if (pgHost !== 'localhost' && !pgHost.includes('.')) {
      console.error('❌ PostgreSQL host appears incomplete or missing domain:', pgHost);
      console.error('💡 Please set `DATABASE_URL` or provide a fully qualified `POSTGRES_HOST` (e.g. my-db.xxxxx.region.rds.amazonaws.com) in your .env or Render environment variables.');
      skipPostgres = true;
    }

    if (skipPostgres) {
      console.warn('⚠️  Skipping PostgreSQL connection attempts due to invalid host configuration.');
      var connected = false; // proceed without DB
    } else {
      if (!sequelizePostgres || typeof sequelizePostgres.authenticate !== 'function') {
        throw new Error('PostgreSQL client is not available or not a Sequelize instance');
      }

      var connected = await retryConnection(
        async () => {
          await sequelizePostgres.authenticate();
        },
        'PostgreSQL',
        3,
        3000
      );
    }

    if (connected) {
      console.log('🔄 Syncing PostgreSQL models...');

      // Safe sync for production
      if (process.env.NODE_ENV === 'development') {
        await sequelizePostgres.sync({ alter: false }); // Safer: don't alter existing tables
        console.log('✅ PostgreSQL models synced (development mode)');
      } else {
        // In production, only authenticate, don't auto-sync
        console.log('ℹ️  Production: PostgreSQL connected, skipping auto-sync');

        // Try to list tables
        try {
          const [results] = await sequelizePostgres.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
            ORDER BY table_name
          `);
          console.log('📋 PostgreSQL tables:', results.map(r => r.table_name).join(', ') || 'No tables found');
        } catch (queryErr) {
          console.warn('⚠️  Could not list PostgreSQL tables:', queryErr.message);
        }
      }
    } else {
      console.warn('⚠️  PostgreSQL not connected - some features may not work');
    }
  } catch (postgresError) {
    console.error('❌ PostgreSQL initialization error:', postgresError.message);

    // Don't crash in production if PostgreSQL fails
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️  Continuing without PostgreSQL in production mode');
    }
  }

  console.log('✅ Database initialization complete\n');
}

// Health endpoint ping (self-check)
async function selfHealthCheck(portToCheck = PORT) {
  try {
    const response = await fetch(`http://localhost:${portToCheck}/api/health`, {
      headers: {
        'User-Agent': 'Node.js self-health-check'
      }
    }).catch(() => null);

    if (response && response.ok) {
      console.log('✅ Server self-health check passed');
    } else {
      console.log('ℹ️  Server is running but health endpoint not accessible yet');
    }
  } catch (error) {
    // Ignore - server might still be starting
  }
}

// Start server and initialize databases
const startServer = async () => {
  try {
    console.log('\n🚀 Starting Express server...');

    // Try listening on PORT, if in use try next ports (up to 3 attempts)
    let basePort = Number(process.env.PORT) || 5000;
    let server;
    let actualPort = basePort;

    const tryListen = (port, attemptsLeft = 3) => new Promise((resolve, reject) => {
      const s = app.listen(port, '0.0.0.0')
        .once('listening', () => resolve({ server: s, port }))
        .once('error', (err) => {
          if (err.code === 'EADDRINUSE' && attemptsLeft > 1) {
            console.warn(`⚠️ Port ${port} in use, trying port ${port + 1}...`);
            // Try next port
            resolve(tryListen(port + 1, attemptsLeft - 1));
          } else {
            reject(err);
          }
        });
    });

    const res = await tryListen(basePort, 3);
    server = res.server;
    actualPort = res.port;

    console.log(`✅ Express server running on port ${actualPort}`);
    console.log(`🌐 Local URL: http://localhost:${actualPort}`);
    console.log(`🔍 Health endpoint: http://localhost:${actualPort}/api/health`);
    console.log('===========================================\n');

    // Update selfHealthCheck to use actualPort
    setTimeout(() => selfHealthCheck(actualPort), 2000);

    // Initialize databases in background
    setTimeout(initializeDatabases, 1000);

    // Handle server errors after startup
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      process.exit(1);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal) => {
      console.log(`\n🔄 ${signal} received. Shutting down gracefully...`);

      // Close server
      server.close(async () => {
        console.log('✅ HTTP server closed');

        // Close database connections
        try {
          const dbConnections = require('./src/config/database');
          const closeResults = await dbConnections.closeAllConnections();
          console.log('✅ Database connections closed:', closeResults);
        } catch (dbError) {
          console.error('❌ Error closing databases:', dbError.message);
        }

        console.log('👋 Shutdown complete');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        console.error('❌ Forcing shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
};

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection at:', promise);
  console.error('Reason:', reason);
  console.error('Stack:', reason?.stack || 'No stack trace');

  // Don't exit in production, just log
  if (process.env.NODE_ENV !== 'production') {
    console.warn('⚠️  Exiting due to unhandled rejection in non-production mode');
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  console.error('Stack:', error.stack);

  setTimeout(() => {
    console.error('⚠️  Forcing exit after uncaught exception');
    process.exit(1);
  }, 1000);
});

startServer();