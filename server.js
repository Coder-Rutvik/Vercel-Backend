require('dotenv').config();
console.log('🔍 Environment Check:', {
  NODE_ENV: process.env.NODE_ENV,
  USER: process.env.POSTGRES_USER,
  DB: process.env.POSTGRES_DATABASE,
  PASS_LENGTH: process.env.POSTGRES_PASSWORD ? process.env.POSTGRES_PASSWORD.length : 0,
  HOST: process.env.POSTGRES_HOST
});
const app = require('./src/app');

// For local development
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel
module.exports = app;