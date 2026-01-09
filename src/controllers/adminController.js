const { Sequelize, Op } = require('sequelize');
const { UserPostgres, BookingPostgres, RoomPostgres } = require('../models/postgresql');

const User = UserPostgres;
const Booking = BookingPostgres;
const Room = RoomPostgres;

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
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all bookings
// @route   GET /api/admin/bookings
// @access  Private/Admin
const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.findAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name', 'email', 'userId']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};



// @desc    Update room
// @route   PUT /api/admin/rooms/:id
// @access  Private/Admin
const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const { roomType, basePrice, isAvailable } = req.body;
    
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
      isAvailable: room.isAvailable
    };
    
    if (roomType) room.roomType = roomType;
    if (basePrice) room.basePrice = basePrice;
    if (isAvailable !== undefined) room.isAvailable = isAvailable;
    
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
          isAvailable: room.isAvailable
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
      message: 'Server error'
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
    const dbStatus = await dbConnections.checkAllConnections();
    // Get total rooms
    const totalRooms = await Room.count();
    const availableRooms = await Room.count({ where: { isAvailable: true } });
    
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
          [Sequelize.Op.gte]: today
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
          occupancyRate: ((totalRooms - availableRooms) / totalRooms * 100).toFixed(2)
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
          postgresql: dbStatus.postgresql.connected ? 'connected' : `disconnected (${dbStatus.postgresql.error})`
        }
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getAllUsers,
  getAllBookings,
  updateRoom,
  getDashboardStats
};