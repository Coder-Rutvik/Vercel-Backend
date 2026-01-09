require('dotenv').config();
const { sequelize } = require('./src/config/database');

console.log('🚀 Starting Hotel Reservation System Backend...');
console.log('===========================================');

// Database setup function - AUTO CREATES TABLES
async function setupDatabase() {
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    
    // Test connection
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    // IMPORTANT: Auto-create tables if they don't exist
    console.log('🔄 Creating/verifying database tables...');
    
    // This creates tables if missing, doesn't drop existing data
    await sequelize.sync({ alter: true });
    console.log('✅ Database tables ready');
    
    // Check what tables were created
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`📊 Found ${tables.length} tables:`);
    tables.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.table_name}`);
    });
    
    // If no tables, log warning (sync should have created them)
    if (tables.length === 0) {
      console.warn('⚠️ No tables found after sync. Seeding needed.');
    } else {
      console.log('✅ All tables are ready!');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    
    // If it's a connection error, we can still start server
    if (error.message.includes('Connection') || error.message.includes('timeout')) {
      console.log('⚠️ Starting with limited functionality (no database)');
      return false;
    }
    
    // For other errors, try to continue
    console.log('⚠️ Continuing with potential database issues');
    return false;
  }
}

// Start everything
async function startServer() {
  console.log('\n📊 Environment Details:');
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   PORT: ${process.env.PORT || 5000}`);
  
  if (process.env.DATABASE_URL) {
    const maskedUrl = process.env.DATABASE_URL.replace(
      /\/\/([^:]+):([^@]+)@/,
      '//$1:****@'
    );
    console.log(`   Database: ${maskedUrl}`);
  }
  
  console.log('===========================================\n');
  
  // Setup database first (this creates tables automatically)
  console.log('⚙️ Setting up database...');
  const dbReady = await setupDatabase();
  
  if (dbReady) {
    console.log('✅ Database setup completed successfully');
  } else {
    console.warn('⚠️ Database setup had issues. Some features may not work.');
  }
  
  // Now start Express server
  const app = require('./src/app');
  const PORT = process.env.PORT || 10000;
  
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n===========================================');
    console.log(`✅ Express server running on port ${PORT}`);
    console.log(`🌐 Local URL: http://localhost:${PORT}`);
    console.log(`🌐 Production URL: https://hotel-reservation-system-backend-6nf6.onrender.com`);
    console.log(`🔍 Health Check: /api/health`);
    console.log(`📊 DB Test: /api/db-test`);
    console.log(`🏠 Home: /`);
    console.log(`💾 Database: ${dbReady ? '✅ Ready' : '⚠️ Issues'}`);
    console.log('===========================================');
    console.log('🎉 Server is ready and accepting requests!');
    console.log('===========================================\n');
    
    // Quick self-test
    console.log('🧪 Quick self-test (after 2 seconds)...');
    setTimeout(async () => {
      try {
        const response = await fetch(`http://localhost:${PORT}/api/health`);
        const data = await response.json();
        console.log(`   Health check: ${data.success ? '✅ OK' : '❌ Failed'}`);
      } catch (e) {
        console.log(`   Health check: ❌ ${e.message}`);
      }
    }, 2000);
  });
  
  // Graceful shutdown
  const shutdown = () => {
    console.log('\n🔄 Shutting down gracefully...');
    server.close(() => {
      console.log('✅ HTTP server closed');
      
      // Try to close database connections
      sequelize.close()
        .then(() => console.log('✅ Database connections closed'))
        .catch(err => console.log('⚠️ Could not close database:', err.message))
        .finally(() => {
          console.log('👋 Shutdown complete');
          process.exit(0);
        });
    });
    
    // Force shutdown after 5 seconds
    setTimeout(() => {
      console.error('❌ Forcing shutdown after timeout');
      process.exit(1);
    }, 5000);
  };
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
  
  // Handle server errors
  server.on('error', (error) => {
    console.error('❌ Server error:', error.message);
    if (error.code === 'EADDRINUSE') {
      console.error(`⚠️ Port ${PORT} is already in use. Trying ${parseInt(PORT) + 1}...`);
    }
  });
}

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection at:', promise);
  console.error('Reason:', reason?.message || reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  console.error('Stack:', error.stack);
  
  // Don't crash immediately, give time for logging
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// Start the application
startServer().catch(error => {
  console.error('❌ Failed to start server:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});