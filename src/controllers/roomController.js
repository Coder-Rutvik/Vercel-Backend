const { Room, Booking } = require('../models');
const { Sequelize, Op } = require('sequelize');

// @desc    Get all rooms
// @route   GET /api/rooms
// @access  Public
const getAllRooms = async (req, res) => {
  try {
    const rooms = await Room.findAll({
      order: [['floor', 'ASC'], ['position', 'ASC']]
    });

    res.json({
      success: true,
      count: rooms.length,
      data: rooms
    });
  } catch (error) {
    console.error('Get rooms error:', error);
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
      where: { isAvailable: true },
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
        [Sequelize.fn('SUM', Sequelize.literal('CASE WHEN is_available = true THEN 1 ELSE 0 END')), 'available']
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
    if (available !== undefined) where.isAvailable = available === 'true';

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
    
    for (const room of shuffled.slice(0, numToBook)) {
      room.isAvailable = false;
      await room.save();
    }
    
    for (const room of shuffled.slice(numToBook)) {
      room.isAvailable = true;
      await room.save();
    }

    res.json({
      success: true,
      message: `Random occupancy generated: ${numToBook} rooms occupied`,
      data: {
        totalRooms: allRooms.length,
        occupiedRooms: numToBook,
        availableRooms: allRooms.length - numToBook,
        occupancyRate: (occupancyRate * 100).toFixed(1) + '%'
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
    await Booking.update(
      { status: 'cancelled' },
      { where: { status: 'confirmed' } }
    );

    await Room.update(
      { isAvailable: true },
      { where: {} }
    );

    const totalRooms = await Room.count();

    res.json({
      success: true,
      message: 'All bookings reset and rooms made available',
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

// @desc    SEED ROOMS (EMERGENCY FIX)
// @route   POST /api/rooms/seed-rooms
// @access  Private
const seedRooms = async (req, res) => {
  try {
    console.log('🏨 Seeding rooms...');
    
    // Delete all existing rooms
    await Room.destroy({ where: {} });
    
    const roomsToCreate = [];
    
    // Create sample rooms (20 rooms total)
    for (let i = 1; i <= 10; i++) {
      roomsToCreate.push({
        roomNumber: 100 + i,
        floor: 1,
        position: i,
        roomType: i <= 7 ? 'standard' : 'deluxe',
        isAvailable: true,
        basePrice: i <= 7 ? 100.00 : 150.00
      });
    }
    
    for (let i = 1; i <= 10; i++) {
      roomsToCreate.push({
        roomNumber: 200 + i,
        floor: 2,
        position: i,
        roomType: 'standard',
        isAvailable: true,
        basePrice: 100.00
      });
    }
    
    await Room.bulkCreate(roomsToCreate);
    
    res.json({
      success: true,
      message: `Successfully seeded ${roomsToCreate.length} rooms`,
      data: {
        totalRooms: roomsToCreate.length,
        rooms: roomsToCreate.map(r => r.roomNumber)
      }
    });
  } catch (error) {
    console.error('Seed rooms error:', error);
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
  resetAllBookings,
  seedRooms
};