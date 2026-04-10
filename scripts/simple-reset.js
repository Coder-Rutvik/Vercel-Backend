const { sequelize } = require('../src/config/database');

async function simpleReset() {
  try {
    console.log('🔄 Starting simple database reset...');
    
    // Force sync will drop and recreate tables
    await sequelize.sync({ force: true });
    console.log('✅ Database synchronized successfully');
    
    // Seed rooms
    const seedRooms = require('../src/utils/roomSeeder');
    await seedRooms();
    console.log('🏨 Rooms seeded successfully');
    
    console.log('🎉 Database reset completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Reset failed:', error);
    process.exit(1);
  }
}

simpleReset();
