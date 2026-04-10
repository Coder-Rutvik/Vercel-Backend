const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { checkAllConnections } = require('../config/database');
const { backupDatabase } = require('../utils/backup');
const { sendWebhook } = require('../utils/webhookNotifier');

const parseBoolean = (value, fallback = false) => {
  if (value == null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
};

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const runBackupRetention = (retentionDays) => {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return;

  const backupDir = path.join(__dirname, '../../backups');
  if (!fs.existsSync(backupDir)) return;

  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(backupDir);

  files.forEach((fileName) => {
    if (!/^backup-.*\.sql$/i.test(fileName)) return;
    const filePath = path.join(backupDir, fileName);
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) return;
    if (stats.mtimeMs >= cutoffMs) return;

    fs.unlinkSync(filePath);
    logger.info('Old backup removed by retention policy', { filePath });
  });
};

const notifyHealthWebhook = async (webhookUrl, eventType, details) => {
  if (!webhookUrl) return;

  const payload = {
    source: 'hotel-reservation-backend',
    eventType,
    timestamp: new Date().toISOString(),
    details
  };

  const response = await sendWebhook({ url: webhookUrl, payload });
  if (!response.ok) {
    logger.error('Health alert webhook failed', {
      eventType,
      statusCode: response.statusCode,
      error: response.error
    });
    return;
  }

  logger.info('Health alert webhook sent', { eventType, statusCode: response.statusCode });
};

const startSystemMonitors = () => {
  const backupSchedulerEnabled = parseBoolean(process.env.ENABLE_BACKUP_SCHEDULER, false);
  const backupIntervalHours = parseNumber(process.env.BACKUP_INTERVAL_HOURS, 24);
  const backupRetentionDays = parseNumber(process.env.BACKUP_RETENTION_DAYS, 7);
  const backupOnStartup = parseBoolean(process.env.BACKUP_ON_STARTUP, false);

  const healthMonitorEnabled = parseBoolean(process.env.HEALTH_MONITOR_ENABLED, true);
  const healthCheckIntervalSeconds = parseNumber(process.env.HEALTH_CHECK_INTERVAL_SECONDS, 60);
  const healthAlertCooldownMinutes = parseNumber(process.env.HEALTH_ALERT_COOLDOWN_MINUTES, 30);
  const healthWebhookUrl = process.env.HEALTH_ALERT_WEBHOOK_URL || '';

  let backupTimer = null;
  let healthTimer = null;
  let lastHealthState = null;
  let lastDownAlertAt = 0;
  let backupRunning = false;
  let healthRunning = false;

  const runBackupJob = async (trigger) => {
    if (backupRunning) {
      logger.warn('Skipped backup tick because previous backup is still running.', { trigger });
      return;
    }
    backupRunning = true;
    try {
      const filePath = await backupDatabase();
      runBackupRetention(backupRetentionDays);
      logger.info('Scheduled backup completed', { trigger, filePath });
    } catch (error) {
      logger.error('Scheduled backup failed', { trigger, error: error.message });
      await notifyHealthWebhook(healthWebhookUrl, 'backup_failed', {
        trigger,
        message: error.message
      });
    } finally {
      backupRunning = false;
    }
  };

  const runHealthCheck = async () => {
    if (healthRunning) return;
    healthRunning = true;
    try {
      const dbStatus = await checkAllConnections();
      const dbConnected = Boolean(dbStatus.postgresql && dbStatus.postgresql.connected);
      const now = Date.now();

      if (dbConnected) {
        if (lastHealthState === 'down') {
          await notifyHealthWebhook(healthWebhookUrl, 'health_recovered', {
            database: 'postgresql',
            status: 'connected'
          });
          logger.warn('Health recovered: PostgreSQL connected.');
        }
        lastHealthState = 'up';
        return;
      }

      const inCooldown =
        now - lastDownAlertAt < healthAlertCooldownMinutes * 60 * 1000;
      if (!inCooldown || lastHealthState !== 'down') {
        await notifyHealthWebhook(healthWebhookUrl, 'health_down', {
          database: 'postgresql',
          error: dbStatus.postgresql ? dbStatus.postgresql.error : 'Unknown DB status'
        });
        lastDownAlertAt = now;
      }

      logger.error('Health check failed: PostgreSQL disconnected.', {
        error: dbStatus.postgresql ? dbStatus.postgresql.error : 'Unknown DB status'
      });
      lastHealthState = 'down';
    } catch (error) {
      logger.error('Health monitor execution failed', { error: error.message });
    } finally {
      healthRunning = false;
    }
  };

  if (backupSchedulerEnabled) {
    const safeHours = Math.max(1, backupIntervalHours);
    const backupEveryMs = safeHours * 60 * 60 * 1000;
    backupTimer = setInterval(() => {
      runBackupJob('interval');
    }, backupEveryMs);
    logger.info('Backup scheduler enabled', { everyHours: safeHours, retentionDays: backupRetentionDays });

    if (backupOnStartup) {
      runBackupJob('startup');
    }
  } else {
    logger.info('Backup scheduler disabled');
  }

  if (healthMonitorEnabled) {
    const safeSeconds = Math.max(15, healthCheckIntervalSeconds);
    const healthEveryMs = safeSeconds * 1000;
    healthTimer = setInterval(() => {
      runHealthCheck();
    }, healthEveryMs);
    logger.info('Health monitor enabled', {
      everySeconds: safeSeconds,
      cooldownMinutes: healthAlertCooldownMinutes,
      webhookConfigured: Boolean(healthWebhookUrl)
    });
    runHealthCheck();
  } else {
    logger.info('Health monitor disabled');
  }

  return {
    stop: () => {
      if (backupTimer) clearInterval(backupTimer);
      if (healthTimer) clearInterval(healthTimer);
    }
  };
};

module.exports = {
  startSystemMonitors
};
