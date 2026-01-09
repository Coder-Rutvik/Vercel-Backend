const { BookingPostgres, UserPostgres, RoomPostgres } = require('../models/postgresql');
const { Op } = require('sequelize');
const algorithmService = require('../services/algorithmService');
const bookingService = require('../services/bookingService');

// Use Postgres models as primary
const Booking = BookingPostgres;
const User = UserPostgres;
const Room = RoomPostgres;

// @desc    Book rooms
// @route   POST /api/bookings
// @access  Private
const bookRooms = async (req, res) => {
  try {
    const { numRooms, checkInDate, checkOutDate } = req.body;
    const userId = req.user.userId;

    // Validate booking
    const validation = await bookingService.validateBooking(numRooms, checkInDate, checkOutDate);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message
      });
    }

    // Find optimal rooms with date check
    const optimalRooms = await bookingService.findOptimalRooms(numRooms, checkInDate, checkOutDate);
    if (!optimalRooms) {
      return res.status(400).json({
        success: false,
        message: `Not enough available rooms for ${numRooms} rooms`
      });
    }

    // Calculate price
    const totalPrice = await bookingService.calculateTotalPrice(optimalRooms, checkInDate, checkOutDate);

    // Create booking
    const booking = await Booking.create({
      userId,
      rooms: optimalRooms.rooms.map(room => room.number),
      totalRooms: numRooms,
      travelTime: optimalRooms.travelTime,
      totalPrice,
      checkInDate,
      checkOutDate,
      status: 'confirmed',
      paymentStatus: 'pending'
    });

    // Unified Write: PostgreSQL is the primary database
    // All operations are already performed on Booking (which is BookingPostgres)

    // Update room availability
    await bookingService.updateRoomAvailability(optimalRooms.rooms.map(r => r.number), false);

    // Log to console
    try {
      console.log('LOG: BOOK_ROOMS', {
        userId: userId.toString(),
        bookingId: booking.bookingId,
        rooms: optimalRooms.rooms.map(r => r.number),
        travelTime: optimalRooms.travelTime,
        totalPrice
      });
    } catch (logError) {
      console.error('Logging error (non-critical):', logError);
    }

    res.status(201).json({
      success: true,
      message: 'Booking successful',
      data: {
        bookingId: booking.bookingId,
        rooms: optimalRooms.rooms.map(r => r.number),
        travelTime: optimalRooms.travelTime,
        totalPrice,
        checkInDate,
        checkOutDate,
        bookingDate: booking.bookingDate,
        status: booking.status
      }
    });

  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get user bookings
// @route   GET /api/bookings/my-bookings
// @access  Private
const getUserBookings = async (req, res) => {
  try {
    const userId = req.user.userId;

    const bookings = await Booking.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name', 'email']
        }
      ]
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

// @desc    Get booking by ID
// @route   GET /api/bookings/:id
// @access  Private
const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const booking = await Booking.findOne({
      where: {
        bookingId: id,
        userId
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['name', 'email']
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Cancel booking
// @route   PUT /api/bookings/:id/cancel
// @access  Private
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const booking = await Booking.findOne({
      where: {
        bookingId: id,
        userId
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Booking is already cancelled'
      });
    }

    // Check if check-in date is in future
    const checkInDate = new Date(booking.checkInDate);
    const today = new Date();
    if (checkInDate <= today) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel booking after check-in date'
      });
    }

    // Unified Write: PostgreSQL is the primary database
    booking.status = 'cancelled';
    await booking.save();

    // Make rooms available again
    await bookingService.updateRoomAvailability(booking.rooms, true);

    // Log to console
    try {
      console.log('LOG: CANCEL_BOOKING', {
        userId: userId.toString(),
        bookingId: id,
        rooms: booking.rooms
      });
    } catch (logError) {
      console.error('Logging error (non-critical):', logError);
    }

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking
    });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get booking statistics
// @route   GET /api/bookings/stats
// @access  Private
const getBookingStats = async (req, res) => {
  try {
    const userId = req.user.userId;

    const totalBookings = await Booking.count({ where: { userId } });
    const confirmedBookings = await Booking.count({
      where: { userId, status: 'confirmed' }
    });
    const cancelledBookings = await Booking.count({
      where: { userId, status: 'cancelled' }
    });
    const totalSpent = await Booking.sum('totalPrice', {
      where: { userId, status: 'confirmed' }
    }) || 0;

    // Recent bookings (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentBookings = await Booking.count({
      where: {
        userId,
        createdAt: { [Op.gte]: thirtyDaysAgo }
      }
    });

    res.json({
      success: true,
      data: {
        total: totalBookings,
        confirmed: confirmedBookings,
        cancelled: cancelledBookings,
        recent: recentBookings,
        totalSpent: parseFloat(totalSpent),
        averageSpent: totalBookings > 0 ? parseFloat(totalSpent) / totalBookings : 0
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
  bookRooms,
  getUserBookings,
  getBookingById,
  cancelBooking,
  getBookingStats
};