require('dotenv').config();
const { sequelizePostgres: sequelize } = require('../config/database');

// Import models (PostgreSQL)
const User = require('../models/postgresql/User');
const Room = require('../models/postgresql/Room');
const Booking = require('../models/postgresql/Booking');

const seedDatabase = async () => {
  try {
    // Sync database (creates tables)
    await sequelize.sync({ force: true });
    console.log('✅ Database synced');

    // Create admin user
    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@hotel.com',
      password: 'admin123',
      phone: '1234567890',
      role: 'admin'
    });
    console.log('✅ Admin user created');

    // Create test user
    const testUser = await User.create({
      name: 'Test User',
      email: 'test@user.com',
      password: 'test123',
      phone: '9876543210',
      role: 'user'
    });
    console.log('✅ Test user created');

    // Create rooms (Floors 1-9: 10 rooms each, Floor 10: 7 rooms)
    const rooms = [];

    // Floors 1-9
    for (let floor = 1; floor <= 9; floor++) {
      for (let roomNum = 1; roomNum <= 10; roomNum++) {
        rooms.push({
          roomNumber: floor * 100 + roomNum,
          floor: floor,
          position: roomNum,
          roomType: floor >= 8 ? 'deluxe' : 'standard',
          basePrice: floor >= 8 ? 150.00 : 100.00,
          isAvailable: true
        });
      }
    }

    // Floor 10 (7 rooms)
    for (let roomNum = 1; roomNum <= 7; roomNum++) {
      rooms.push({
        roomNumber: 1000 + roomNum,
        floor: 10,
        position: roomNum,
        roomType: 'suite',
        basePrice: 200.00,
        isAvailable: true
      });
    }

    await Room.bulkCreate(rooms);
    console.log(`✅ Created ${rooms.length} rooms`);

    console.log('🎉 Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
};

seedDatabase();