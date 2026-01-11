// src/controllers/adminController.js - UPDATED
const { Sequelize, Op } = require('sequelize');
const { sequelize } = require('../config/database');

// ✅ CORRECT: Import from models/index.js
const db = require('../models');
const User = db.User;
const Booking = db.Booking;
const Room = db.Room;

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] }
    });

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Get users error:', error);

    // If users table doesn't exist
    if (error.message.includes('relation "users" does not exist') || error.code === '42P01') {
      return res.status(500).json({
        success: false,
        message: 'Users table not initialized. Please register a user first.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get all bookings
// @route   GET /api/admin/bookings
// @access  Private/Admin
const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.findAll({
      order: [['createdAt', 'DESC']]
    });

    // Get user details for each booking
    const bookingsWithUsers = await Promise.all(
      bookings.map(async (booking) => {
        const bookingData = booking.toJSON();
        const user = await User.findByPk(booking.userId, {
          attributes: ['name', 'email', 'userId']
        });
        return {
          ...bookingData,
          user: user || { name: 'User', email: 'N/A', userId: booking.userId }
        };
      })
    );

    res.json({
      success: true,
      count: bookings.length,
      data: bookingsWithUsers
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Update room
// @route   PUT /api/admin/rooms/:id
// @access  Private/Admin
const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const { roomType, basePrice, status } = req.body;

    const room = await Room.findByPk(id);

    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'Room not found'
      });
    }

    // Save old values before updating
    const oldValues = {
      roomType: room.roomType,
      basePrice: room.basePrice,
      status: room.status
    };

    if (roomType) room.roomType = roomType;
    if (basePrice) room.basePrice = basePrice;
    if (status) room.status = status;

    await room.save();

    // Audit: logged to console
    try {
      console.log('AUDIT: Room Update', {
        entity: 'Room',
        entityId: id.toString(),
        action: 'UPDATE',
        oldValue: oldValues,
        newValue: {
          roomType: room.roomType,
          basePrice: room.basePrice,
          status: room.status
        },
        changedBy: req.user.email,
        changedById: req.user.userId.toString(),
        ipAddress: req.ip
      });
    } catch (err) {
      console.error('Audit log error:', err);
    }

    res.json({
      success: true,
      message: 'Room updated successfully',
      data: room
    });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Get dashboard stats
// @route   GET /api/admin/stats
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
  try {
    // Check database connections
    const dbConnections = require('../config/database');
    const dbStatus = await dbConnections.checkConnection();

    // Get total rooms
    const totalRooms = await Room.count();
    const availableRooms = await Room.count({ where: { status: 'not-booked' } });

    // Get total bookings
    const totalBookings = await Booking.count();
    const confirmedBookings = await Booking.count({ where: { status: 'confirmed' } });
    const cancelledBookings = await Booking.count({ where: { status: 'cancelled' } });

    // Get total users
    const totalUsers = await User.count();
    const adminUsers = await User.count({ where: { role: 'admin' } });

    // Get revenue stats
    const revenueResult = await Booking.sum('totalPrice', {
      where: { status: 'confirmed', paymentStatus: 'paid' }
    });
    const totalRevenue = revenueResult || 0;

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaysBookings = await Booking.count({
      where: {
        createdAt: {
          [Op.gte]: today
        }
      }
    });

    res.json({
      success: true,
      data: {
        rooms: {
          total: totalRooms,
          available: availableRooms,
          occupied: totalRooms - availableRooms,
          occupancyRate: totalRooms > 0 ? ((totalRooms - availableRooms) / totalRooms * 100).toFixed(2) : "0.00"
        },
        bookings: {
          total: totalBookings,
          confirmed: confirmedBookings,
          cancelled: cancelledBookings,
          today: todaysBookings
        },
        users: {
          total: totalUsers,
          admins: adminUsers,
          regular: totalUsers - adminUsers
        },
        revenue: {
          total: parseFloat(totalRevenue),
          formatted: `₹${parseFloat(totalRevenue).toLocaleString('en-IN')}`
        },
        databases: {
          postgresql: dbStatus.connected ? 'connected' : `disconnected (${dbStatus.error})`
        }
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);

    // If tables don't exist
    if (error.message.includes('does not exist') || error.code === '42P01') {
      return res.json({
        success: true,
        data: {
          rooms: { total: 0, available: 0, occupied: 0, occupancyRate: "0.00" },
          bookings: { total: 0, confirmed: 0, cancelled: 0, today: 0 },
          users: { total: 0, admins: 0, regular: 0 },
          revenue: { total: 0, formatted: '₹0' },
          databases: { postgresql: 'tables not initialized' }
        },
        message: 'Database tables not initialized yet'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getAllUsers,
  getAllBookings,
  updateRoom,
  getDashboardStats
};