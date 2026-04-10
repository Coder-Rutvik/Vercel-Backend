const path = require('path');
const { restoreDatabase } = require('../src/utils/backup');

const inputArg = process.argv[2];
if (!inputArg) {
  // eslint-disable-next-line no-console
  console.error('Usage: node scripts/restore-database.js <backup-file.sql>');
  process.exit(1);
}

const inputFile = path.resolve(inputArg);

restoreDatabase({ inputFile })
  .then((filePath) => {
    // eslint-disable-next-line no-console
    console.log(`RESTORE_OK ${filePath}`);
    process.exit(0);
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(`RESTORE_FAILED ${error.message}`);
    process.exit(1);
  });
