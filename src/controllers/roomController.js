const { Room, Booking } = require('../models');
const { Sequelize, Op } = require('sequelize');
const seedRooms = require('../utils/roomSeeder');

// @desc    Get all rooms
// @route   GET /api/rooms
// @access  Public
const getAllRooms = async (req, res) => {
  try {
    // Check and seed if empty (Auto-Recovery)
    await seedRooms();

    const rooms = await Room.findAll({
      order: [['roomNumber', 'ASC']]
    });

    res.json({
      success: true,
      count: rooms.length,
      data: rooms
    });
  } catch (error) {
    console.error('Get all rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
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
      data: rooms
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
      data: room
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
    if (roomType) where.roomType = roomType;

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
      data: rooms
    });
  } catch (error) {
    console.error('Search rooms error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Generate random occupancy
// @route   POST /api/rooms/random-occupancy
// @access  Private
const generateRandomOccupancy = async (req, res) => {
  try {
    const { Order, Bill, User } = require('../models');

    const allRooms = await Room.findAll();
    const occupancyRate = 0.4 + Math.random() * 0.4; // 40-80% load
    const numToBook = Math.floor(allRooms.length * occupancyRate);
    const shuffled = allRooms.sort(() => 0.5 - Math.random());

    const bookedRooms = shuffled.slice(0, numToBook);
    const unbookedRooms = shuffled.slice(numToBook);

    // Make sure we have a mock user
    let user = await User.findOne();
    if (!user) user = await User.create({ name: 'System Seed', email: 'seed@hotel.com', password: 'seed' });

    // Seed robust data for each booked room
    const mockMenuItems = [
      { name: 'Paneer Butter Masala', category: 'Indian', price: 250 },
      { name: 'Chicken Tikka', category: 'Indian', price: 350 },
      { name: 'Biryani', category: 'Indian', price: 400 },
      { name: 'Pizza', category: 'Italian', price: 300 }
    ];

    let totalOrdersCreated = 0;
    let totalBillsPaid = 0;

    for (const room of bookedRooms) {
      room.status = 'booked';
      await room.save();

      // Create Booking
      const b = await Booking.create({
        userId: user.userId,
        rooms: [room.roomNumber],
        totalRooms: 1,
        totalPrice: room.basePrice * 2,
        checkInDate: new Date(),
        checkOutDate: new Date(Date.now() + 86400000 * 2),
        status: 'confirmed'
      });

      // Random KOT Orders for each mock booking
      const itemRandom = mockMenuItems[Math.floor(Math.random() * mockMenuItems.length)];
      const order = await Order.create({
        bookingId: b.bookingId,
        tableNumber: null,
        items: [{ ...itemRandom, quantity: 2 }],
        totalPrice: itemRandom.price * 2,
        status: 'delivered', // Mock old orders
        paymentStatus: 'pending'
      });
      totalOrdersCreated++;

      // Create a finalized bill roughly 30% of the time to generate P&L historical data
      if (Math.random() > 0.7) {
        const roomTotal = parseFloat(b.totalPrice);
        const foodTotal = parseFloat(order.totalPrice);
        const subtotal = roomTotal + foodTotal;
        const tax = subtotal * 0.18;
        const grandTotal = subtotal + tax;

        await Bill.create({
          bookingId: b.bookingId,
          roomTotal, foodTotal, subtotal, taxAmount: tax, grandTotal,
          isPaid: true, paymentMode: 'UPI'
        });
        
        b.status = 'completed';
        room.status = 'not-booked';
        order.paymentStatus = 'paid';
        await b.save();
        await room.save();
        await order.save();
        totalBillsPaid++;
      }
    }

    for (const room of unbookedRooms) {
      room.status = 'not-booked';
      await room.save();
    }

    const actuallyBooked = bookedRooms.length - totalBillsPaid;

    res.json({
      success: true,
      message: `Full Load Simulation: ${bookedRooms.length} rooms checked-in, ${totalOrdersCreated} KOT generated, ${totalBillsPaid} checkouts and bills paid for PNL.`,
      data: {
        totalRooms: allRooms.length,
        occupiedRooms: actuallyBooked,
        availableRooms: allRooms.length - actuallyBooked,
        occupancyRate: ((actuallyBooked / allRooms.length) * 100).toFixed(1) + '%',
      }
    });
  } catch (error) {
    console.error('Generate random occupancy error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Reset all bookings and make all rooms available
// @route   POST /api/rooms/reset-all
// @access  Private
const resetAllBookings = async (req, res) => {
  try {
    // 1. Clear all bookings
    await Booking.destroy({ where: {} });
    console.log('✅ All bookings cleared');

    // 2. Reset all rooms to 'not-booked'
    await Room.update(
      { status: 'not-booked' },
      { where: {} }
    );
    console.log('✅ All rooms reset to available');

    const totalRooms = await Room.count();

    res.json({
      success: true,
      message: 'Reset complete! Bookings cleared and rooms are now available.',
      data: {
        totalRooms,
        availableRooms: totalRooms
      }
    });
  } catch (error) {
    console.error('Reset all bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
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