const { Booking, Room, User } = require('../models');
const { Op } = require('sequelize');

const parseDateOnly = (value) => {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const str = String(value);
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  }
  const dt = new Date(str);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
};

// @desc Webhook for Channel Manager (Booking.com / Airbnb)
// @route POST /api/pro/channel-webhook
// @access Public (Requires API Key in real life)
exports.channelManagerSync = async (req, res) => {
  try {
    const { source, externalBookingId, checkIn, checkOut, guestName, guestEmail, roomType, totalRooms } = req.body;
    const channel = (source || 'channel-manager').toString();
    const requestedRooms = Math.min(Math.max(parseInt(totalRooms || 1, 10), 1), 5);
    const checkInDate = parseDateOnly(checkIn);
    const checkOutDate = parseDateOnly(checkOut);

    if (!checkInDate || !checkOutDate || checkOutDate <= checkInDate) {
      return res.status(400).json({
        success: false,
        message: 'Invalid check-in/check-out date from channel payload'
      });
    }

    const dayMs = 1000 * 60 * 60 * 24;
    const nights = Math.trunc((checkOutDate.getTime() - checkInDate.getTime()) / dayMs);

    const conflicts = await Booking.findAll({
      where: {
        status: 'confirmed',
        checkInDate: { [Op.lt]: checkOutDate },
        checkOutDate: { [Op.gt]: checkInDate }
      },
      attributes: ['rooms']
    });
    const bookedRoomNumbers = new Set();
    conflicts.forEach((b) => {
      if (Array.isArray(b.rooms)) {
        b.rooms.forEach((roomNo) => bookedRoomNumbers.add(Number(roomNo)));
      }
    });

    const whereClause = {};
    if (roomType && roomType !== 'Any') whereClause.roomType = roomType;
    const candidates = await Room.findAll({
      where: whereClause,
      order: [['floor', 'ASC'], ['position', 'ASC']]
    });
    const availableRooms = candidates.filter((r) => !bookedRoomNumbers.has(Number(r.roomNumber)));

    if (availableRooms.length < requestedRooms) {
      return res.status(409).json({
        success: false,
        message: `Channel sync failed: only ${availableRooms.length} rooms available for requested ${requestedRooms}`
      });
    }

    const selectedRooms = availableRooms.slice(0, requestedRooms);
    const totalPrice = selectedRooms.reduce((sum, room) => sum + (parseFloat(room.basePrice) || 0), 0) * nights;

    const normalizedSource = channel.toLowerCase().replace(/[^a-z0-9]/g, '');
    const fallbackEmail = `${normalizedSource || 'channel'}@channel-sync.local`;
    const integrationEmail = (guestEmail && String(guestEmail).trim()) || fallbackEmail;

    let channelUser = await User.findOne({ where: { email: integrationEmail } });
    if (!channelUser) {
      channelUser = await User.create({
        name: guestName || `${channel} Guest`,
        email: integrationEmail,
        password: `channel-${Date.now()}`,
        role: 'user'
      });
    }

    const booking = await Booking.create({
      userId: channelUser.userId,
      rooms: selectedRooms.map((r) => r.roomNumber),
      totalRooms: requestedRooms,
      travelTime: 0,
      totalPrice: parseFloat(totalPrice.toFixed(2)),
      checkInDate,
      checkOutDate,
      status: 'confirmed'
    });

    console.log(`[CHANNEL MANAGER] Synced booking from ${channel}. External ID: ${externalBookingId || 'N/A'}`);
    res.status(200).json({
      success: true,
      message: `Booking synced from ${channel}`,
      data: {
        bookingId: booking.bookingId,
        roomNumbers: booking.rooms,
        externalBookingId: externalBookingId || null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc AI Demand Prediction & Auto Price Suggestion
// @route GET /api/pro/ai-demand
// @access Private (Admin)
exports.aiDemandPrediction = async (req, res) => {
  try {
    const totalRooms = await Room.count();
    const today = new Date().toISOString().slice(0, 10);
    const activeBookings = await Booking.findAll({
      where: {
        status: 'confirmed',
        checkInDate: { [Op.lte]: today },
        checkOutDate: { [Op.gt]: today }
      },
      attributes: ['rooms']
    });
    const occupiedRoomNumbers = new Set();
    activeBookings.forEach((booking) => {
      if (Array.isArray(booking.rooms)) {
        booking.rooms.forEach((roomNo) => occupiedRoomNumbers.add(Number(roomNo)));
      }
    });

    const bookedRooms = occupiedRoomNumbers.size;
    const occupancyRate = totalRooms > 0 ? (bookedRooms / totalRooms) * 100 : 0;

    let suggestion = '';
    let surgeMultiplier = 1.0;

    if (occupancyRate > 80) {
      suggestion = 'High demand detected (Occupancy > 80%). Suggestion: Increase base prices by 15% to maximize revenue.';
      surgeMultiplier = 1.15;
    } else if (occupancyRate < 30) {
      suggestion = 'Low demand. Suggestion: Apply a 10% discount promo code to attract customers.';
      surgeMultiplier = 0.90;
    } else {
      suggestion = 'Stable demand. Keep current pricing strategy.';
    }

    res.status(200).json({
      success: true,
      data: {
        activeDate: today,
        occupiedRooms: bookedRooms,
        totalRooms,
        currentOccupancy: `${occupancyRate.toFixed(2)}%`,
        aiSuggestion: suggestion,
        recommendedPriceMultiplier: surgeMultiplier
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
