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
    const allRooms = await Room.findAll();
    const occupancyRate = 0.3 + Math.random() * 0.3;
    const numToBook = Math.floor(allRooms.length * occupancyRate);
    const shuffled = allRooms.sort(() => 0.5 - Math.random());

    const bookedRooms = shuffled.slice(0, numToBook);
    const unbookedRooms = shuffled.slice(numToBook);

    for (const room of bookedRooms) {
      room.status = 'booked';
      await room.save();
    }

    for (const room of unbookedRooms) {
      room.status = 'not-booked';
      await room.save();
    }

    const bookedNumbers = bookedRooms.map(r => r.roomNumber);

    res.json({
      success: true,
      message: `Random occupancy generated: ${numToBook} rooms occupied`,
      data: {
        totalRooms: allRooms.length,
        occupiedRooms: numToBook,
        availableRooms: allRooms.length - numToBook,
        occupancyRate: (occupancyRate * 100).toFixed(1) + '%',
        bookedRooms: bookedNumbers
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
    // Delete ALL bookings
    await Booking.destroy({ where: {} });
    console.log('✅ All bookings deleted');

    // Delete ALL rooms
    await Room.destroy({ where: {} });
    console.log('✅ All rooms deleted');

    // Recreate 97 rooms using the helper
    const createdCount = await seedRooms();

    res.json({
      success: true,
      message: `Reset complete! ${createdCount || 97} rooms recreated (101-110...1001-1007)`,
      data: {
        totalRooms: createdCount || 97,
        availableRooms: createdCount || 97
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