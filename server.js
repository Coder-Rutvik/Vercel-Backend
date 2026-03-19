require('dotenv').config();
console.log('🔍 Environment Check:', {
  NODE_ENV: process.env.NODE_ENV,
  USER: process.env.POSTGRES_USER,
  DB: process.env.POSTGRES_DATABASE,
  PASS_LENGTH: process.env.POSTGRES_PASSWORD ? process.env.POSTGRES_PASSWORD.length : 0,
  HOST: process.env.POSTGRES_HOST
});
const app = require('./src/app');
const http = require('http');
const { Server } = require('socket.io');

// For local development
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  
  // Create HTTP server manually to attach socket.io
  const server = http.createServer(app);
  
  const io = new Server(server, {
    cors: {
      origin: '*', // same as your express cors
      methods: ['GET', 'POST', 'PUT']
    }
  });

  // Attach io to req.app so controllers can access it
  app.set('io', io);

  io.on('connection', (socket) => {
    console.log(`📡 Socket connected: ${socket.id}`);
    
    // Example: kitchen staff joins a room to get specific orders securely if needed
    socket.on('join-kitchen', () => {
      socket.join('kitchen');
      console.log(`👨‍🍳 Socket ${socket.id} joined kitchen dashboard`);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  server.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
  });
}

// Export for Vercel (Socket.io has limitations on Vercel serverless, so sticking to fallback polling or ignoring there)
module.exports = app;