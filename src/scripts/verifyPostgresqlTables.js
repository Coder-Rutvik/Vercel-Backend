require('dotenv').config();
const { sequelizePostgres } = require('../config/database');

const verifyTables = async () => {
  try {
    console.log('🔍 Verifying PostgreSQL tables...\n');

    // Test connection
    await sequelizePostgres.authenticate();
    console.log('✅ PostgreSQL connection OK\n');

    // Query to check tables
    const queryInterface = sequelizePostgres.getQueryInterface();

    // Check users table
    const usersTable = await queryInterface.showAllTables();
    console.log('📊 Tables found in PostgreSQL database:');
    console.log('===========================================');

    if (usersTable.length === 0) {
      console.log('❌ No tables found!');
    } else {
      usersTable.forEach((table, index) => {
        console.log(`${index + 1}. ${table}`);
      });
      console.log('===========================================');

      // Check specific tables
      const tableNames = usersTable.map(t => t.toLowerCase());
      const expectedTables = ['users', 'rooms', 'bookings'];

      console.log('\n✅ Table Verification:');
      expectedTables.forEach(table => {
        if (tableNames.includes(table.toLowerCase())) {
          console.log(`  ✅ ${table} - EXISTS`);
        } else {
          console.log(`  ❌ ${table} - NOT FOUND`);
        }
      });

      // Get table info
      if (tableNames.includes('users')) {
        console.log('\n📋 Users table structure:');
        const usersInfo = await sequelizePostgres.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`);
        usersInfo[0].forEach(col => {
          console.log(`  - ${col.column_name} (${col.data_type})`);
        });
      }
    }

    console.log('\n🎉 Verification complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

verifyTables();

