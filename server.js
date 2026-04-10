require('dotenv').config();
const logger = require('./src/utils/logger');
const { validateEnv } = require('./src/config/env');

let env;
try {
  env = validateEnv();
} catch (error) {
  // eslint-disable-next-line no-console
  console.error(error.message);
  process.exit(1);
}

logger.info('Environment check', {
  nodeEnv: env.NODE_ENV,
  dbUser: process.env.POSTGRES_USER,
  dbName: process.env.POSTGRES_DATABASE,
  dbHost: process.env.POSTGRES_HOST
});

const app = require('./src/app');
const http = require('http');
const { Server } = require('socket.io');
const { startSystemMonitors } = require('./src/services/systemMonitorService');

let localServer = null;
let monitors = null;

const shutdown = (signal) => {
  logger.warn(`Received ${signal}. Shutting down gracefully...`);
  if (monitors) {
    monitors.stop();
    logger.info('Background monitors stopped.');
  }

  if (localServer) {
    localServer.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 10000).unref();
    return;
  }

  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    reason: reason && reason.message ? reason.message : String(reason)
  });
});
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
});

// For non-serverless runtime
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  localServer = http.createServer(app);

  const io = new Server(localServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT']
    }
  });

  app.set('io', io);

  io.on('connection', (socket) => {
    logger.info('Socket connected', { socketId: socket.id });

    socket.on('join-kitchen', () => {
      socket.join('kitchen');
      logger.info('Socket joined kitchen room', { socketId: socket.id });
    });

    socket.on('disconnect', () => {
      logger.info('Socket disconnected', { socketId: socket.id });
    });
  });

  monitors = startSystemMonitors();

  localServer.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
