const { Room, Booking } = require('../models');
const { Sequelize, Op } = require('sequelize');
const seedRooms = require('../utils/roomSeeder');
const { enrichRoomRecord } = require('../utils/roomPresentation');

const parseDateOnly = (value) => {
  if (value == null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const str = String(value);
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return new Date(Date.UTC(y, mo - 1, d));
  }
  const dt = new Date(str);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
};

// @desc    Get all rooms
// @route   GET /api/rooms
// @access  Public
const getAllRooms = async (req, res) => {
  try {
    // Check and seed if empty (Auto-Recovery)
    await seedRooms();

    // Optional per-date derived status:
    // If client sends checkInDate/checkOutDate query params, mark rooms as booked
    // when they have an overlapping confirmed booking in that date range.
    const { checkInDate, checkOutDate } = req.query;
    let bookedRoomNumbers = new Set();

    if (checkInDate && checkOutDate) {
      const checkInParsed = parseDateOnly(checkInDate);
      const checkOutParsed = parseDateOnly(checkOutDate);

      if (checkInParsed && checkOutParsed) {
        // Only derive availability for valid ranges
        if (checkOutParsed.getTime() <= checkInParsed.getTime()) {
          bookedRoomNumbers = new Set();
        } else {
        const conflictingBookings = await Booking.findAll({
          where: {
            status: 'confirmed',
            // Exclusive overlap check for DATEONLY ranges:
            // newStart < existingEnd AND newEnd > existingStart
            checkInDate: { [Op.lt]: checkOutParsed },
            checkOutDate: { [Op.gt]: checkInParsed }
          },
          attributes: ['rooms']
        });

        conflictingBookings.forEach(b => {
          if (Array.isArray(b.rooms)) {
            b.rooms.forEach(n => bookedRoomNumbers.add(Number(n)));
          }
        });
        }
      }
    }

    const rooms = await Room.findAll({
      order: [['roomNumber', 'ASC']]
    });

    const derivedRooms = rooms.map((r) => {
      const room = enrichRoomRecord(r);
      const roomNum = Number(room.roomNumber);
      const isBooked = bookedRoomNumbers.has(roomNum);
      return {
        ...room,
        status: isBooked ? 'booked' : 'not-booked'
      };
    });

    res.json({
      success: true,
      count: derivedRooms.length,
      data: derivedRooms
    });
  } catch (error) {
    console.error('Get all rooms error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      stack: error.stack
    });
  }
};

// @desc    Get available rooms
// @route   GET /api/rooms/available
// @access  Public
const getAvailableRooms = async (req, res) => {
  try {
    const rooms = await Room.findAll({
      where: { status: 'not-booked' },
      order: [['floor', 'ASC'], ['position', 'ASC']]
    });

    res.json({
      success: true,
      count: rooms.length,
      data: rooms.map((r) => enrichRoomRecord(r))
    });
  } catch (error) {
    console.error('Get available rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get room by floor
// @route   GET /api/rooms/floor/:floorNumber
// @access  Public
const getRoomsByFloor = async (req, res) => {
  try {
    const { floorNumber } = req.params;

    const rooms = await Room.findAll({
      where: { floor: floorNumber },
      order: [['position', 'ASC']]
    });

    if (rooms.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No rooms found on floor ${floorNumber}`
      });
    }

    res.json({
      success: true,
      count: rooms.length,
      floor: floorNumber,
      data: rooms
    });
  } catch (error) {
    console.error('Get rooms by floor error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get room by number
// @route   GET /api/rooms/number/:roomNumber
// @access  Public
const getRoomByNumber = async (req, res) => {
  try {
    const { roomNumber } = req.params;

    const room = await Room.findOne({
      where: { roomNumber }
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: `Room ${roomNumber} not found`
      });
    }

    res.json({
      success: true,
      data: enrichRoomRecord(room)
    });
  } catch (error) {
    console.error('Get room by number error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get room types
// @route   GET /api/rooms/types
// @access  Public
const getRoomTypes = async (req, res) => {
  try {
    const roomTypes = await Room.findAll({
      attributes: [
        'roomType',
        [Sequelize.fn('COUNT', Sequelize.col('room_id')), 'count'],
        [Sequelize.fn('AVG', Sequelize.col('base_price')), 'avgPrice'],
        [Sequelize.fn('SUM', Sequelize.literal("CASE WHEN status = 'not-booked' THEN 1 ELSE 0 END")), 'available']
      ],
      group: ['roomType'],
      raw: true
    });

    res.json({
      success: true,
      data: roomTypes
    });
  } catch (error) {
    console.error('Get room types error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Search rooms
// @route   GET /api/rooms/search
// @access  Public
const searchRooms = async (req, res) => {
  try {
    const { floor, roomType, minPrice, maxPrice, available } = req.query;

    let where = {};

    if (floor) where.floor = floor;
    if (roomType) {
      const raw = String(roomType).trim();
      where.roomType = { [Op.iLike]: `%${raw}%` };
    }

    if (available !== undefined) {
      where.status = available === 'true' ? 'not-booked' : 'booked';
    }

    if (minPrice || maxPrice) {
      where.basePrice = {};
      if (minPrice) where.basePrice[Op.gte] = minPrice;
      if (maxPrice) where.basePrice[Op.lte] = maxPrice;
    }

    const rooms = await Room.findAll({
      where,
      order: [['floor', 'ASC'], ['position', 'ASC']]
    });

    res.json({
      success: true,
      count: rooms.length,
      data: rooms.map((r) => enrichRoomRecord(r))
    });
  } catch (error) {
    console.error('Search rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Generate random occupancy (BULLETPROOF - Per-date Model Aligned)
// @route   POST /api/rooms/random-occupancy
// @access  Private
const generateRandomOccupancy = async (req, res) => {
  try {
    const { Order, Bill, User, sequelize } = require('../models');
    const { Op } = require('sequelize');

    // Start transaction for data consistency
    const transaction = await sequelize.transaction();

    try {
      const allRooms = await Room.findAll({ transaction });
      const occupancyRate = 0.4 + Math.random() * 0.4; // 40-80% load
      const numToBook = Math.floor(allRooms.length * occupancyRate);
      const shuffled = allRooms.sort(() => 0.5 - Math.random());

      const bookedRooms = shuffled.slice(0, numToBook);
      const unbookedRooms = shuffled.slice(numToBook);

      // Make sure we have a mock user
      let user = await User.findOne({ transaction });
      if (!user) {
        user = await User.create({ 
          name: 'System Seed', 
          email: 'seed@hotel.com', 
          password: 'seed',
          role: 'admin'
        }, { transaction });
      }

      // Generate realistic date ranges for bookings
      const today = new Date();
      const generateDateRange = () => {
        const startOffset = Math.floor(Math.random() * 7) - 3; // -3 to +3 days from today
        const length = Math.floor(Math.random() * 5) + 1; // 1-5 nights
        
        const checkIn = new Date(today);
        checkIn.setDate(today.getDate() + startOffset);
        
        const checkOut = new Date(checkIn);
        checkOut.setDate(checkIn.getDate() + length);
        
        return { checkIn, checkOut };
      };

      // Seed robust data for each booked room
      const mockMenuItems = [
        { name: 'Paneer Butter Masala', category: 'Indian', price: 250 },
        { name: 'Chicken Tikka', category: 'Indian', price: 350 },
        { name: 'Biryani', category: 'Indian', price: 400 },
        { name: 'Pizza', category: 'Italian', price: 300 }
      ];

      let totalOrdersCreated = 0;
      let totalBillsPaid = 0;
      const bookingData = [];

      // Create bookings with proper date ranges
      for (const room of bookedRooms) {
        const { checkIn, checkOut } = generateDateRange();
        
        // Create Booking with proper date-only values
        const booking = await Booking.create({
          userId: user.userId,
          rooms: [room.roomNumber],
          totalRooms: 1,
          travelTime: 0,
          totalPrice: room.basePrice * Math.max(1, Math.ceil((checkOut - checkIn) / (86400000))),
          checkInDate: checkIn,
          checkOutDate: checkOut,
          status: 'confirmed'
        }, { transaction });

        bookingData.push({
          roomNumber: room.roomNumber,
          checkIn: checkIn.toISOString().split('T')[0],
          checkOut: checkOut.toISOString().split('T')[0]
        });

        // Random KOT Orders for each mock booking
        const itemRandom = mockMenuItems[Math.floor(Math.random() * mockMenuItems.length)];
        const order = await Order.create({
          bookingId: booking.bookingId,
          tableNumber: null,
          items: [{ ...itemRandom, quantity: 2 }],
          totalPrice: itemRandom.price * 2,
          status: 'delivered', // Mock old orders
          paymentStatus: 'unpaid'
        }, { transaction });
        totalOrdersCreated++;

        // Create a finalized bill roughly 30% of the time to generate P&L historical data
        if (Math.random() > 0.7) {
          const roomTotal = parseFloat(booking.totalPrice);
          const foodTotal = parseFloat(order.totalPrice);
          const subtotal = 0; // Will be calculated in frontend
          const tax = (roomTotal + foodTotal) * 0.18;
          const grandTotal = roomTotal + foodTotal + tax;

          await Bill.create({
            bookingId: booking.bookingId,
            roomTotal, 
            foodTotal, 
            subtotal, 
            taxAmount: tax, 
            grandTotal,
            isPaid: true, 
            paymentMode: 'upi'
          }, { transaction });
          
          booking.status = 'completed';
          order.paymentStatus = 'paid';
          await booking.save({ transaction });
          await order.save({ transaction });
          totalBillsPaid++;
        }
      }

      // CRITICAL: Don't manipulate Room.status anymore - availability is derived per-date
      // Reset all rooms to 'not-booked' status (base state)
      await Room.update(
        { status: 'not-booked' },
        { where: {}, transaction }
      );

      await transaction.commit();

      const actuallyBooked = bookedRooms.length - totalBillsPaid;

      res.json({
        success: true,
        message: `🎲 Bulletproof Random Occupancy Generated: ${bookedRooms.length} bookings with realistic date ranges, ${totalOrdersCreated} KOT orders, ${totalBillsPaid} completed checkouts.`,
        data: {
          totalRooms: allRooms.length,
          occupiedRooms: actuallyBooked,
          availableRooms: allRooms.length - actuallyBooked,
          occupancyRate: ((actuallyBooked / allRooms.length) * 100).toFixed(1) + '%',
          bookings: bookingData, // Show generated booking dates for verification
          note: 'Room availability is now calculated per-date based on actual bookings'
        }
      });
    } catch (transactionError) {
      await transaction.rollback();
      throw transactionError;
    }
  } catch (error) {
    console.error('Generate random occupancy error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate random occupancy: ' + error.message,
      error: error.message
    });
  }
};

// @desc    Reset all bookings and make all rooms available (GLOBAL HARD RESET)
// @route   POST /api/rooms/reset-all
// @access  Private
const resetAllBookings = async (req, res) => {
  try {
    const { Booking, Room, Order, Bill } = require('../models');
    console.log('🔄 [APP RESET] Clearing bookings, orders, and bills...');
    
    // Clear operational records ONLY, preserving Users and Schema
    await Order.destroy({ where: {} });
    await Bill.destroy({ where: {} });
    await Booking.destroy({ where: {} });
    
    await Room.update(
      { status: 'not-booked' },
      { where: {} }
    );
    console.log('✅ [APP RESET] All rooms reset to available!');

    // Reseed the rooms cleanly
    const seedRooms = require('../utils/roomSeeder');
    await seedRooms();

    const totalRooms = await Room.count();

    res.json({
      success: true,
      message: 'Global Reset complete! Database Schema rebuilt entirely and rooms seeded.',
      data: {
        totalRooms,
        availableRooms: totalRooms
      }
    });
  } catch (error) {
    console.error('Reset all bookings error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      stack: error.stack
    });
  }
};

module.exports = {
  getAllRooms,
  getAvailableRooms,
  getRoomsByFloor,
  getRoomByNumber,
  getRoomTypes,
  searchRooms,
  generateRandomOccupancy,
  resetAllBookings
};