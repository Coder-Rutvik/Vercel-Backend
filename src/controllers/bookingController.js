const { BookingPostgres, UserPostgres, RoomPostgres } = require('../models');
const { Op } = require('sequelize');

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

    console.log('📅 Booking attempt by user:', userId, { numRooms, checkInDate, checkOutDate });

    // ✅ SIMPLE VALIDATION
    if (!numRooms || numRooms < 1 || numRooms > 5) {
      return res.status(400).json({
        success: false,
        message: 'Number of rooms must be between 1 and 5'
      });
    }

    if (!checkInDate || !checkOutDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide check-in and check-out dates'
      });
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkIn < today) {
      return res.status(400).json({
        success: false,
        message: 'Check-in date cannot be in the past'
      });
    }

    if (checkOut <= checkIn) {
      return res.status(400).json({
        success: false,
        message: 'Check-out date must be after check-in date'
      });
    }

    // ✅ FIND AVAILABLE ROOMS (NO COMPLEX ALGORITHM)
    console.log('🔍 Looking for available rooms...');
    const allAvailableRooms = await Room.findAll({
      where: { isAvailable: true },
      order: [['floor', 'ASC'], ['position', 'ASC']]
    });

    console.log(`📊 Found ${allAvailableRooms.length} available rooms`);

    if (allAvailableRooms.length < numRooms) {
      return res.status(400).json({
        success: false,
        message: `Not enough available rooms. Need ${numRooms}, but only ${allAvailableRooms.length} available`
      });
    }

    // ✅ SIMPLE SELECTION: Take first N available rooms
    const selectedRooms = allAvailableRooms.slice(0, numRooms);
    const roomNumbers = selectedRooms.map(room => room.roomNumber);
    
    // ✅ CALCULATE TRAVEL TIME (SIMPLE LOGIC)
    let travelTime = 0;
    if (selectedRooms.length > 1) {
      // Check if all rooms on same floor
      const firstFloor = selectedRooms[0].floor;
      const sameFloor = selectedRooms.every(room => room.floor === firstFloor);
      
      if (sameFloor) {
        // All on same floor: calculate distance between positions
        const positions = selectedRooms.map(r => r.position);
        const maxPos = Math.max(...positions);
        const minPos = Math.min(...positions);
        travelTime = (maxPos - minPos) * 2; // 2 minutes per room gap
      } else {
        // Different floors: 3 minutes per room + 5 minutes per floor change
        travelTime = (selectedRooms.length * 3) + 5;
      }
    }

    // ✅ CALCULATE PRICE
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
    let totalPrice = 0;
    selectedRooms.forEach(room => {
      let pricePerNight = parseFloat(room.basePrice);
      
      // Weekend pricing
      const checkInDay = checkIn.getDay(); // 0=Sunday, 5=Friday, 6=Saturday
      if (checkInDay === 5 || checkInDay === 6) {
        pricePerNight *= 1.2; // 20% weekend increase
      }
      
      totalPrice += pricePerNight * nights;
    });

    totalPrice = parseFloat(totalPrice.toFixed(2));

    // ✅ CREATE BOOKING
    console.log('💾 Creating booking...');
    const booking = await Booking.create({
      userId,
      rooms: roomNumbers,
      totalRooms: numRooms,
      travelTime,
      totalPrice,
      checkInDate,
      checkOutDate,
      status: 'confirmed',
      paymentStatus: 'pending'
    });

    // ✅ UPDATE ROOM AVAILABILITY
    await Room.update(
      { isAvailable: false },
      {
        where: {
          roomNumber: roomNumbers
        }
      }
    );

    console.log('✅ Booking created successfully:', {
      bookingId: booking.bookingId,
      rooms: roomNumbers,
      travelTime,
      totalPrice
    });

    res.status(201).json({
      success: true,
      message: 'Booking successful!',
      data: {
        bookingId: booking.bookingId,
        rooms: roomNumbers,
        travelTime,
        totalPrice,
        checkInDate,
        checkOutDate,
        bookingDate: booking.bookingDate,
        status: booking.status,
        nights: nights
      }
    });

  } catch (error) {
    console.error('❌ Booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during booking',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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

    booking.status = 'cancelled';
    await booking.save();

    // Make rooms available again
    await Room.update(
      { isAvailable: true },
      {
        where: {
          roomNumber: booking.rooms
        }
      }
    );

    console.log('✅ Booking cancelled:', { bookingId: id, userId });

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