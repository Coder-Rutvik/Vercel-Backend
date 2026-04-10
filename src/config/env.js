const Joi = require('joi');

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(5000),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRE: Joi.string().default('7d'),
  DATABASE_URL: Joi.string().allow(''),
  POSTGRES_HOST: Joi.string().allow('').default('127.0.0.1'),
  POSTGRES_PORT: Joi.number().port().default(5432),
  POSTGRES_DATABASE: Joi.string().allow('').default('hotel_reservation_db'),
  POSTGRES_USER: Joi.string().allow('').default('postgres'),
  POSTGRES_PASSWORD: Joi.string().allow('').default('postgres'),
  FRONTEND_URL: Joi.string().allow('').default(''),
  RATE_LIMIT_MAX: Joi.number().integer().min(10).default(1000),
  REQUIRE_HTTPS: Joi.string().valid('true', 'false').default('true'),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly').default('info'),
  ENABLE_BACKUP_SCHEDULER: Joi.string().valid('true', 'false').default('false'),
  BACKUP_INTERVAL_HOURS: Joi.number().integer().min(1).max(168).default(24),
  BACKUP_RETENTION_DAYS: Joi.number().integer().min(1).max(365).default(7),
  BACKUP_ON_STARTUP: Joi.string().valid('true', 'false').default('false'),
  HEALTH_MONITOR_ENABLED: Joi.string().valid('true', 'false').default('true'),
  HEALTH_CHECK_INTERVAL_SECONDS: Joi.number().integer().min(15).max(3600).default(60),
  HEALTH_ALERT_WEBHOOK_URL: Joi.string().uri({ scheme: ['http', 'https'] }).allow('').default(''),
  HEALTH_ALERT_COOLDOWN_MINUTES: Joi.number().integer().min(1).max(1440).default(30)
})
  .unknown(true)
  .custom((value, helpers) => {
    const isProd = value.NODE_ENV === 'production';
    if (isProd && !value.DATABASE_URL && !value.POSTGRES_HOST) {
      return helpers.error('any.custom', { message: 'Production requires DATABASE_URL or POSTGRES_HOST config.' });
    }
    return value;
  });

const validateEnv = () => {
  const { value, error } = envSchema.validate(process.env, { abortEarly: false });
  if (error) {
    const details = error.details.map((d) => d.message).join('; ');
    throw new Error(`Environment validation failed: ${details}`);
  }

  return {
    ...value,
    REQUIRE_HTTPS: String(value.REQUIRE_HTTPS) === 'true'
  };
};

module.exports = {
  validateEnv
};
