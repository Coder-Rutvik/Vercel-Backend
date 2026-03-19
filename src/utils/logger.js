const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'hotel-reservation-service' },
  transports: [
    // Vercel Serverless handles stdout directly in its logs dashboard
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  ],
});

module.exports = logger;
