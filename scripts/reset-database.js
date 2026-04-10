const { sequelize } = require('../src/config/database');
const { User, Room, Booking, MenuItem, Order, Expense, Bill, AuditLog, InventoryItem, Vendor, PurchaseOrder, HousekeepingTask, Notification } = require('../src/models');

async function resetDatabase() {
  try {
    console.log('🔄 Starting database reset...');
    
    // Drop all tables
    await sequelize.drop();
    console.log('🗑️  All tables dropped');
    
    // Recreate all tables
    await sequelize.sync({ force: true });
    console.log('✅ All tables recreated');
    
    // Seed initial data
    const seedRooms = require('../src/utils/roomSeeder');
    await seedRooms();
    console.log('🏨 Rooms seeded successfully');
    
    console.log('🎉 Database reset completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database reset failed:', error);
    process.exit(1);
  }
}

resetDatabase();
