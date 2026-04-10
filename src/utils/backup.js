const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

const getDbConfig = () => ({
  host: process.env.POSTGRES_HOST || '127.0.0.1',
  port: String(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DATABASE || 'hotel_reservation_db',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || ''
});

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
};

const runExecFile = (bin, args, env) =>
  new Promise((resolve, reject) => {
    execFile(bin, args, { env }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${error.message}${stderr ? ` | ${stderr}` : ''}`));
        return;
      }
      resolve({ stdout, stderr });
    });
  });

const formatTimestamp = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
};

const backupDatabase = async ({ outputFile } = {}) => {
  const db = getDbConfig();
  const backupDir = path.join(__dirname, '../../backups');
  ensureDir(backupDir);

  const filePath =
    outputFile || path.join(backupDir, `backup-${db.database}-${formatTimestamp()}.sql`);
  const dumpBinary = process.env.PG_DUMP_PATH || 'pg_dump';
  const args = [
    '-h',
    db.host,
    '-p',
    db.port,
    '-U',
    db.user,
    '-d',
    db.database,
    '--no-owner',
    '--no-acl',
    '-F',
    'p',
    '-f',
    filePath
  ];

  const env = { ...process.env, PGPASSWORD: db.password };
  await runExecFile(dumpBinary, args, env);
  logger.info('Database backup created', { filePath });
  return filePath;
};

const restoreDatabase = async ({ inputFile } = {}) => {
  if (!inputFile) throw new Error('restoreDatabase requires inputFile path.');
  const resolvedPath = path.resolve(inputFile);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Backup file not found: ${resolvedPath}`);
  }

  const db = getDbConfig();
  const psqlBinary = process.env.PSQL_PATH || 'psql';
  const args = [
    '-h',
    db.host,
    '-p',
    db.port,
    '-U',
    db.user,
    '-d',
    db.database,
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    resolvedPath
  ];

  const env = { ...process.env, PGPASSWORD: db.password };
  await runExecFile(psqlBinary, args, env);
  logger.info('Database restore completed', { filePath: resolvedPath });
  return resolvedPath;
};

module.exports = {
  backupDatabase,
  restoreDatabase
};
