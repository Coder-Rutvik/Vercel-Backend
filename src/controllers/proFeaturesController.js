const { Booking, Room } = require('../models');

// @desc Webhook for Channel Manager (Booking.com / Airbnb)
// @route POST /api/pro/channel-webhook
// @access Public (Requires API Key in real life)
exports.channelManagerSync = async (req, res) => {
  try {
    const { source, externalBookingId, checkIn, checkOut, guestName, roomType } = req.body;
    // In real life: Parse, check availability, create booking, block room
    console.log(`[CHANNEL MANAGER] Syncing booking from ${source}`);
    res.status(200).json({ success: true, message: `Booking synced from ${source}` });
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
    const bookedRooms = await Room.count({ where: { status: 'booked' } });
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
        currentOccupancy: `${occupancyRate.toFixed(2)}%`,
        aiSuggestion: suggestion,
        recommendedPriceMultiplier: surgeMultiplier
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
