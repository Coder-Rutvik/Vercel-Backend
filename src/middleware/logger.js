const { randomUUID } = require('crypto');
const logger = require('../utils/logger');

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'jwt',
  'secret',
  'accessToken',
  'refreshToken'
]);

const sanitize = (value) => {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((v) => sanitize(v));
  if (typeof value !== 'object') return value;

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(String(k).toLowerCase())) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = sanitize(v);
    }
  }
  return out;
};

const requestLogger = (req, res, next) => {
  const start = process.hrtime.bigint();
  const requestId = req.headers['x-request-id'] || randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    try {
      const durationMs = Number((process.hrtime.bigint() - start) / 1000000n);
      logger.info('HTTP request completed', {
        requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs,
        ip: req.ip,
        userId: req.user?.userId || null,
        query: sanitize(req.query),
        body: sanitize(req.body)
      });
    } catch (err) {
      logger.error('Request logging failed', { error: err.message, requestId });
    }
  });

  next();
};

module.exports = requestLogger;
