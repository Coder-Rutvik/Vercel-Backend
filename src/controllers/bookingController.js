const { Booking, User, Room, Order, Bill } = require('../models');
const { Op, Sequelize } = require('sequelize');
const { sequelize } = require('../config/database');

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

// @desc    Book rooms (Entrepreneurial Logic - Smart Fallback Select)
// @route   POST /api/bookings
const bookRooms = async (req, res) => {
  try {
    const { numRooms, checkInDate, checkOutDate, roomType, floorPreference, selectedRoomNumbers } = req.body;
    const userId = req.user.userId;

    // 1. Validation
    if (!numRooms || numRooms < 1 || numRooms > 5) {
      return res.status(400).json({ success: false, message: 'Select 1 to 5 rooms' });
    }

    const checkInParsed = parseDateOnly(checkInDate);
    const checkOutParsed = parseDateOnly(checkOutDate);

    if (!checkInParsed || !checkOutParsed) {
      return res.status(400).json({ success: false, message: 'Invalid check-in/check-out date.' });
    }

    const dayMs = 1000 * 60 * 60 * 24;
    const nightsRaw = (checkOutParsed.getTime() - checkInParsed.getTime()) / dayMs;
    const nights = Math.trunc(nightsRaw);

    if (!Number.isFinite(nights) || nights <= 0) {
      return res.status(400).json({ success: false, message: 'Check-out date must be after check-in date.' });
    }

    let finalRoomNumbers = [];

    // Build per-date booked-room set (only confirmed bookings, overlapping date-range)
    const conflictingBookings = await Booking.findAll({
      where: {
        status: 'confirmed',
        // Exclusive overlap check for DATEONLY ranges:
        // newStart < existingEnd AND newEnd > existingStart
        checkInDate: { [Op.lt]: checkOutParsed },
        checkOutDate: { [Op.gt]: checkInParsed },
      },
      attributes: ['rooms']
    });

    const bookedRoomNumbers = new Set();
    conflictingBookings.forEach(b => {
      if (Array.isArray(b.rooms)) {
        b.rooms.forEach(n => bookedRoomNumbers.add(Number(n)));
      }
    });

    const targetFloor = floorPreference && floorPreference !== 'Any' ? parseInt(floorPreference) : null;
    const isTypeAny = !roomType || roomType === 'Any';

    // --- LOGIC A: Manual Map Selection (User clicked rooms) ---
    if (selectedRoomNumbers && selectedRoomNumbers.length > 0) {
      if (selectedRoomNumbers.length !== numRooms) {
        return res.status(400).json({ success: false, message: `Please select exactly ${numRooms} rooms on the floor map.` });
      }

      // Validate selected rooms belong to preferred floor + roomType (if provided)
      const roomsSelected = await Room.findAll({
        where: { roomNumber: { [Op.in]: selectedRoomNumbers } }
      });

      if (roomsSelected.length !== numRooms) {
        return res.status(400).json({ success: false, message: 'One or more selected rooms are invalid.' });
      }

      if (targetFloor) {
        const anyMismatchFloor = roomsSelected.some(r => Number(r.floor) !== targetFloor);
        if (anyMismatchFloor) {
          return res.status(400).json({ success: false, message: `Selected rooms must be on Floor ${targetFloor}.` });
        }
      }

      if (!isTypeAny) {
        const anyMismatchType = roomsSelected.some(r => r.roomType !== roomType);
        if (anyMismatchType) {
          return res.status(400).json({ success: false, message: `Selected rooms must match room type "${roomType}".` });
        }
      }

      const unavailable = selectedRoomNumbers.filter(n => bookedRoomNumbers.has(Number(n)));
      if (unavailable.length > 0) {
        return res.status(400).json({ success: false, message: `Room ${unavailable[0]} unavailable!` });
      }

      finalRoomNumbers = selectedRoomNumbers;
    } 
    // --- LOGIC B: Smart Floor Preference WITH Fallback ---
    else {
      const whereClause = {};
      if (!isTypeAny) whereClause.roomType = roomType;

      // 1st Priority: Try finding all required rooms on the EXACT preferred floor
      if (targetFloor) {
        const floorCandidates = await Room.findAll({
          where: { ...whereClause, floor: targetFloor },
          order: [['position', 'ASC']]
        });

        const availableFloorCandidates = floorCandidates.filter(r => !bookedRoomNumbers.has(Number(r.roomNumber)));

        if (availableFloorCandidates.length >= numRooms) {
          finalRoomNumbers = availableFloorCandidates.slice(0, numRooms).map(r => r.roomNumber);
        } else {
          // 2nd Priority: Floor is FULL or partially empty -> Show Warning/Alert in Response
          // The USER wants an "Alert" telling them the floor is full!
          return res.status(400).json({ 
            success: false, 
            message: `⚠️ Floor ${targetFloor} is FULL! Please choose another floor or use manual selection.`,
            errorType: 'FLOOR_FULL' 
          });
        }
      } 
      // No floor preference: Just take the first available rooms
      else {
        const anyCandidates = await Room.findAll({
          where: whereClause,
          order: [['floor', 'ASC'], ['position', 'ASC']]
        });

        const availableAnyCandidates = anyCandidates.filter(r => !bookedRoomNumbers.has(Number(r.roomNumber)));

        if (availableAnyCandidates.length < numRooms) {
          return res.status(400).json({ success: false, message: 'No rooms available!' });
        }

        finalRoomNumbers = availableAnyCandidates.slice(0, numRooms).map(r => r.roomNumber);
      }
    }

    // 2. Pricing & Transaction
    const roomsToBook = await Room.findAll({ where: { roomNumber: { [Op.in]: finalRoomNumbers } } });

    if (!roomsToBook || roomsToBook.length !== numRooms) {
      return res.status(400).json({
        success: false,
        message: 'Could not validate room selection. Please try again with valid rooms.',
        details: {
          expected: numRooms,
          found: roomsToBook ? roomsToBook.length : 0
        }
      });
    }

    let basePriceSum = 0;
    roomsToBook.forEach(r => { basePriceSum += parseFloat(r.basePrice); });
    const totalPrice = parseFloat((basePriceSum * nights).toFixed(2));

    const result = await sequelize.transaction(
      {
        // Helps prevent phantoms on concurrent overlap checks (best-effort for race-safety)
        isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE
      },
      async (t) => {
        // Lock chosen rooms for the duration of the transaction.
        // (Prevents two concurrent bookings from finalizing the same rooms.)
        await Room.findAll({
          where: { roomNumber: { [Op.in]: finalRoomNumbers } },
          lock: t.LOCK.UPDATE,
          transaction: t
        });

        // Race-safety: re-check overlapping confirmed bookings inside transaction.
        // Lock matching bookings rows too (best-effort).
        const latestConflicts = await Booking.findAll({
          where: {
            status: 'confirmed',
            // Exclusive overlap check for DATEONLY ranges:
            // newStart < existingEnd AND newEnd > existingStart
            checkInDate: { [Op.lt]: checkOutParsed },
            checkOutDate: { [Op.gt]: checkInParsed },
          },
          attributes: ['rooms'],
          lock: t.LOCK.UPDATE,
          transaction: t
        });

        const latestBookedRoomNumbers = new Set();
        latestConflicts.forEach(b => {
          if (Array.isArray(b.rooms)) {
            b.rooms.forEach(n => latestBookedRoomNumbers.add(Number(n)));
          }
        });

        const stillUnavailable = finalRoomNumbers.filter(n => latestBookedRoomNumbers.has(Number(n)));
        if (stillUnavailable.length > 0) {
          const err = new Error(`Room ${stillUnavailable[0]} unavailable!`);
          err.statusCode = 400;
          throw err;
        }

        const newBooking = await Booking.create(
          {
            // travelTime is required in the model; set to 0 if not computed here
            userId,
            rooms: finalRoomNumbers,
            totalRooms: numRooms,
            travelTime: 0,
            totalPrice,
            checkInDate: checkInParsed,
            checkOutDate: checkOutParsed,
            status: 'confirmed'
          },
          { transaction: t }
        );
        return newBooking;
      }
    );

    if (req.app.get('io')) {
      req.app.get('io').emit('booking-created', {
        bookingId: result.bookingId,
        userId,
        rooms: result.rooms,
        checkInDate: result.checkInDate,
        checkOutDate: result.checkOutDate
      });
    }

    res.status(201).json({ success: true, message: 'Booking successful!', data: result });

  } catch (error) {
    const statusCode = error && error.statusCode ? error.statusCode : 500;
    res.status(statusCode).json({ success: false, message: error.message });
  }
};

const getUserBookings = async (req, res) => {
  try {
    const userId = req.user.userId;
    const bookings = await Booking.findAll({ where: { userId }, order: [['createdAt', 'DESC']] });
    res.json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed' });
  }
};

const cancelBooking = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Validate booking exists and belongs to user
    const booking = await Booking.findOne({ 
      where: { bookingId: id, userId: req.user.userId },
      include: [{
        model: Order,
        as: 'orders'
      }],
      transaction 
    });
    
    if (!booking) {
      await transaction.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found or you do not have permission to cancel it' 
      });
    }

    // Business rule: Cannot cancel completed bookings
    if (booking.status === 'completed') {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot cancel a completed booking' 
      });
    }

    // Business rule: Cannot cancel bookings that are in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDate = new Date(booking.checkInDate);
    checkInDate.setHours(0, 0, 0, 0);
    
    if (checkInDate < today) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot cancel bookings for past dates' 
      });
    }

    // Update booking status
    booking.status = 'cancelled';
    await booking.save({ transaction });

    // Cancel any associated orders
    if (booking.orders && booking.orders.length > 0) {
      await Order.update(
        { status: 'cancelled' },
        { 
          where: { bookingId: booking.bookingId },
          transaction 
        }
      );
    }

    await transaction.commit();
    
    res.json({ 
      success: true, 
      message: 'Booking cancelled successfully. Any associated orders have also been cancelled.',
      data: {
        bookingId: booking.bookingId,
        cancelledAt: new Date().toISOString()
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Cancel booking error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to cancel booking: ' + error.message 
    });
  }
};

const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const booking = await Booking.findOne({ 
      where: { bookingId: id, userId: req.user.userId },
      include: [{
        model: Order,
        as: 'orders'
      }, {
        model: Bill,
        as: 'bill'
      }]
    });
    
    if (!booking) {
      return res.status(404).json({ 
        success: false, 
        message: 'Booking not found or you do not have permission to view it' 
      });
    }
    
    res.json({ 
      success: true, 
      data: booking,
      message: 'Booking retrieved successfully'
    });
  } catch (error) {
    console.error('Get booking by ID error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve booking: ' + error.message 
    });
  }
};

const getBookingStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get comprehensive booking statistics
    const [total, confirmed, cancelled, completed, totalSpent] = await Promise.all([
      Booking.count({ where: { userId } }),
      Booking.count({ where: { userId, status: 'confirmed' } }),
      Booking.count({ where: { userId, status: 'cancelled' } }),
      Booking.count({ where: { userId, status: 'completed' } }),
      Booking.sum('totalPrice', {
        where: { userId, status: { [Op.in]: ['confirmed', 'completed'] } }
      })
    ]);

    // Get upcoming bookings
    const today = new Date();
    const upcoming = await Booking.count({
      where: {
        userId,
        status: 'confirmed',
        checkInDate: { [Op.gte]: today }
      }
    });

    // Get total nights booked
    const bookings = await Booking.findAll({
      where: { userId, status: { [Op.in]: ['confirmed', 'completed'] } },
      attributes: ['checkInDate', 'checkOutDate']
    });

    const dateOnlyToUtcMs = (value) => {
      if (value == null) return null;
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
      }
      const str = String(value);
      const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m) {
        return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      }
      const t = new Date(str).getTime();
      return Number.isNaN(t) ? null : t;
    };

    let totalNights = 0;
    bookings.forEach((booking) => {
      const ci = dateOnlyToUtcMs(booking.checkInDate);
      const co = dateOnlyToUtcMs(booking.checkOutDate);
      if (ci != null && co != null && co > ci) {
        totalNights += Math.round((co - ci) / (1000 * 60 * 60 * 24));
      }
    });

    res.json({ 
      success: true, 
      data: { 
        total,
        confirmed,
        cancelled,
        completed,
        upcoming,
        totalSpent: totalSpent || 0,
        totalNights,
        averageBookingValue: total > 0 ? (totalSpent || 0) / total : 0
      },
      message: 'Booking statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Get booking stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve booking statistics: ' + error.message 
    });
  }
};

module.exports = { bookRooms, getUserBookings, getBookingById, cancelBooking, getBookingStats };
