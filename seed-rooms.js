require('dotenv').config();
const { sequelize } = require('./src/config/database');
const { RoomPostgres, UserPostgres, BookingPostgres } = require('./src/models/postgresql');
const { Op } = require('sequelize');

async function seedDatabase() {
  console.log('🌱 Seeding Hotel Reservation Database...');
  console.log('===========================================\n');

  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Sync models (ensure tables exist)
    await sequelize.sync({ alter: true });
    console.log('✅ Database models synced');

    // 1. Clear existing data
    console.log('\n🧹 Clearing existing data...');
    await BookingPostgres.destroy({ where: {} });
    await RoomPostgres.destroy({ where: {} });
    
    // Don't delete admin users - FIXED SYNTAX
    await UserPostgres.destroy({ 
      where: { 
        email: { 
          [Op.notLike]: 'admin@%' 
        } 
      } 
    });
    
    console.log('✅ Existing data cleared');

    // 2. Create Admin User if not exists
    console.log('\n👑 Creating admin user...');
    try {
      const [adminUser, created] = await UserPostgres.findOrCreate({
        where: { email: 'admin@hotel.com' },
        defaults: {
          name: 'Admin User',
          email: 'admin@hotel.com',
          password: 'admin123',
          phone: '1234567890',
          role: 'admin'
        }
      });
      
      if (created) {
        console.log(`✅ Admin user created (ID: ${adminUser.userId})`);
      } else {
        console.log(`ℹ️ Admin user already exists (ID: ${adminUser.userId})`);
      }
    } catch (err) {
      console.error('❌ Error creating admin user:', err.message);
    }

    // 3. Create Test User if not exists
    console.log('\n👤 Creating test user...');
    try {
      const [testUser, created] = await UserPostgres.findOrCreate({
        where: { email: 'test@user.com' },
        defaults: {
          name: 'Test User',
          email: 'test@user.com',
          password: 'test123',
          phone: '9876543210',
          role: 'user'
        }
      });
      
      if (created) {
        console.log(`✅ Test user created (ID: ${testUser.userId})`);
      } else {
        console.log(`ℹ️ Test user already exists (ID: ${testUser.userId})`);
      }
    } catch (err) {
      console.error('❌ Error creating test user:', err.message);
    }

    // 4. Create Rooms
    console.log('\n🏨 Creating rooms...');
    const rooms = [];
    
    // Floors 1-9: 10 rooms each
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

    // Floor 10: 7 rooms
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

    await RoomPostgres.bulkCreate(rooms);
    console.log(`✅ Created ${rooms.length} rooms`);
    
    // Show room distribution
    console.log('\n📊 Room Distribution:');
    console.log(`   Floors 1-7: 70 Standard rooms (₹100/night)`);
    console.log(`   Floors 8-9: 20 Deluxe rooms (₹150/night)`);
    console.log(`   Floor 10: 7 Suite rooms (₹200/night)`);
    console.log(`   Total: ${rooms.length} rooms`);

    // 5. Create Sample Bookings (Optional)
    console.log('\n📅 Creating sample bookings...');
    try {
      // Get admin user
      const admin = await UserPostgres.findOne({ where: { email: 'admin@hotel.com' } });
      
      if (admin) {
        // Book some rooms for admin
        const booking = await BookingPostgres.create({
          userId: admin.userId,
          rooms: [101, 102, 103],
          totalRooms: 3,
          travelTime: 2, // minutes
          totalPrice: 300.00,
          checkInDate: new Date(),
          checkOutDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days later
          status: 'confirmed',
          paymentStatus: 'paid'
        });
        
        // Mark those rooms as unavailable
        await RoomPostgres.update(
          { isAvailable: false },
          { where: { roomNumber: [101, 102, 103] } }
        );
        
        console.log(`✅ Sample booking created (ID: ${booking.bookingId})`);
        console.log(`   Booked rooms: 101, 102, 103`);
      }
    } catch (err) {
      console.log('⚠️ Could not create sample booking:', err.message);
    }

    // 6. Verification
    console.log('\n🔍 Verifying database...');
    
    const userCount = await UserPostgres.count();
    const roomCount = await RoomPostgres.count();
    const availableRooms = await RoomPostgres.count({ where: { isAvailable: true } });
    const bookedRooms = await RoomPostgres.count({ where: { isAvailable: false } });
    const bookingCount = await BookingPostgres.count();
    
    console.log(`👥 Users: ${userCount}`);
    console.log(`🏨 Rooms: ${roomCount} total (${availableRooms} available, ${bookedRooms} booked)`);
    console.log(`📅 Bookings: ${bookingCount}`);
    
    // Show some room examples
    console.log('\n🏢 Sample Rooms:');
    const sampleRooms = await RoomPostgres.findAll({
      where: { floor: [1, 2, 10] },
      order: [['floor', 'ASC'], ['position', 'ASC']],
      limit: 10
    });
    
    sampleRooms.forEach(room => {
      const status = room.isAvailable ? '🟢 Available' : '🔴 Booked';
      console.log(`   ${room.roomNumber} - Floor ${room.floor}, ${room.roomType} - ${status}`);
    });

    console.log('\n===========================================');
    console.log('🎉 Database seeding completed successfully!');
    console.log('===========================================');
    console.log('\n🔑 Login Credentials:');
    console.log('   Admin: admin@hotel.com / admin123');
    console.log('   User: test@user.com / test123');
    console.log('\n🚀 Next Steps:');
    console.log('   1. Start server: npm start');
    console.log('   2. Test API: http://localhost:5000/api/health');
    console.log('   3. View rooms: http://localhost:5000/api/rooms');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🌱 Hotel Reservation Database Seeder

Usage:
  node seed-rooms.js          # Seed database with default data
  node seed-rooms.js --clean  # Clear all data first
  node seed-rooms.js --help   # Show this help

Options:
  --clean    Clear all existing data before seeding
  --rooms    Only seed rooms (skip users and bookings)
  --help     Show help information
  `);
  process.exit(0);
}

seedDatabase();