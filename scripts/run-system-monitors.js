require('dotenv').config();
const logger = require('../src/utils/logger');
const { validateEnv } = require('../src/config/env');
const { startSystemMonitors } = require('../src/services/systemMonitorService');

try {
  validateEnv();
} catch (error) {
  // eslint-disable-next-line no-console
  console.error(error.message);
  process.exit(1);
}

logger.info('Starting standalone system monitor worker...');
const monitors = startSystemMonitors();

const stop = (signal) => {
  logger.warn(`Received ${signal}. Stopping system monitor worker...`);
  monitors.stop();
  process.exit(0);
};

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
