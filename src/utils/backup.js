const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Simple Backup Script for Postgres
const backupDatabase = () => {
  const date = new Date().toISOString().split('T')[0];
  const backupDir = path.join(__dirname, '../../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const fileName = `backup-${date}.sql`;
  const filePath = path.join(backupDir, fileName);

  const command = `pg_dump -U ${process.env.POSTGRES_USER || 'postgres'} -h ${process.env.POSTGRES_HOST || 'localhost'} -d ${process.env.POSTGRES_DATABASE || 'hotel_db'} -F p -f ${filePath}`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Backup error: ${error.message}`);
      return;
    }
    console.log(`✅ Backup successfully created at: ${filePath}`);
    
    // In production, this would upload to S3.
  });
};

// If run directly
if (require.main === module) {
  backupDatabase();
}

module.exports = backupDatabase;
