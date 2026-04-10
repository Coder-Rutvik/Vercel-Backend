const path = require('path');
const { backupDatabase } = require('../src/utils/backup');

const outputArg = process.argv[2];
const outputFile = outputArg ? path.resolve(outputArg) : undefined;

backupDatabase({ outputFile })
  .then((filePath) => {
    // eslint-disable-next-line no-console
    console.log(`BACKUP_OK ${filePath}`);
    process.exit(0);
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(`BACKUP_FAILED ${error.message}`);
    process.exit(1);
  });
