require('dotenv').config();
const { sequelize } = require('./src/config/database');

async function testDatabase() {
  console.log('🧪 Testing Database Connection...\n');

  try {
    // 1. Test connection
    await sequelize.authenticate();
    console.log('✅ Database connection successful');

    // 2. List tables
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('\n📊 Tables in database:');
    tables.forEach((table, index) => {
      console.log(`${index + 1}. ${table.table_name}`);
    });

    // 3. Check if tables exist
    const expectedTables = ['users', 'rooms', 'bookings'];
    const tableNames = tables.map(t => t.table_name.toLowerCase());
    
    console.log('\n✅ Table Status:');
    expectedTables.forEach(table => {
      if (tableNames.includes(table)) {
        console.log(`  ✅ ${table} - EXISTS`);
      } else {
        console.log(`  ❌ ${table} - MISSING`);
      }
    });

    // 4. Create tables if missing
    if (tableNames.length === 0) {
      console.log('\n🔄 Creating tables...');
      await sequelize.sync({ force: false });
      console.log('✅ Tables created successfully');
    }

    // 5. Test basic queries
    console.log('\n🧪 Testing basic queries:');
    
    // Test users table
    try {
      const userCount = await sequelize.query('SELECT COUNT(*) FROM users');
      console.log(`👥 Users count: ${userCount[0][0].count}`);
    } catch (err) {
      console.log('👥 Users table query failed (might be empty)');
    }

    // Test rooms table
    try {
      const roomCount = await sequelize.query('SELECT COUNT(*) FROM rooms');
      console.log(`🏨 Rooms count: ${roomCount[0][0].count}`);
      
      if (roomCount[0][0].count === '0') {
        console.log('⚠️ Rooms table is empty - need to seed database');
      }
    } catch (err) {
      console.log('🏨 Rooms table query failed (might be empty or not exist)');
    }

    console.log('\n🎉 Database test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.error('Stack:', error.stack);
    
    // Try to create database if it doesn't exist
    if (error.code === '3D000' || error.message.includes('database')) {
      console.log('\n💡 Database might not exist. Creating...');
      await createDatabase();
    }
    
    process.exit(1);
  }
}

async function createDatabase() {
  try {
    // Connect without database
    const sequelizeNoDb = new (require('sequelize').Sequelize)(
      'postgres',
      process.env.POSTGRES_USER || 'postgres',
      process.env.POSTGRES_PASSWORD || 'rutvik',
      {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        dialect: 'postgres',
        logging: false
      }
    );

    // Create database
    await sequelizeNoDb.query(`CREATE DATABASE ${process.env.POSTGRES_DATABASE || 'hotel_reservation_db'}`);
    console.log('✅ Database created successfully');
    
    // Close connection
    await sequelizeNoDb.close();
    
    // Now sync tables
    await sequelize.sync({ force: false });
    console.log('✅ Tables created successfully');
    
    return true;
  } catch (err) {
    console.error('❌ Failed to create database:', err.message);
    return false;
  }
}

testDatabase();