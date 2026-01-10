require('dotenv').config();
const app = require('./src/app');
const { connect } = require('./src/config/database');

const PORT = process.env.PORT || 5000;

// Initialize database
const initialize = async () => {
  try {
    console.log('🔄 Initializing database connection...');
    await connect();
    console.log('✅ Database initialization complete');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
  }
};

if (process.env.VERCEL) {
  console.log('🚀 Running in Vercel Serverless mode');
  // Pre-initialize DB but don't block the export
  initialize();
  module.exports = app;
} else {
  const startServer = async () => {
    await initialize();
    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌐 Local URL: http://localhost:${PORT}`);
    });
  };
  startServer();
}