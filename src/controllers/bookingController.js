const { Booking, User, Room } = require('../models');
const { Op } = require('sequelize');

// Helper function to ensure rooms exist
const ensureRoomsExist = async () => {
  try {
    const roomCount = await Room.count();
    if (roomCount === 0) {
      console.log('🏨 No rooms found. Creating 97 rooms...');
      const rooms = [];
      for (let floor = 1; floor <= 9; floor++) {
        for (let pos = 1; pos <= 10; pos++) {
          rooms.push({
            roomNumber: (floor * 100) + pos,
            floor: floor,
            position: pos,
            roomType: 'standard',
            basePrice: 100.00,
            status: 'not-booked'
          });
        }
      }
      for (let pos = 1; pos <= 7; pos++) {
        rooms.push({
          roomNumber: 1000 + pos,
          floor: 10,
          position: pos,
          roomType: 'standard',
          basePrice: 100.00,
          status: 'not-booked'
        });
      }
      await Room.bulkCreate(rooms);
      return 97;
    }
    return roomCount;
  } catch (error) {
    console.error('❌ Failed to ensure rooms:', error);
    return 0;
  }
};

// @desc    Book rooms
// @route   POST /api/bookings
// @access  Private
// Helper to calculate travel time between two rooms
const getTravelTime = (r1, r2) => {
  if (r1.floor === r2.floor) {
    return Math.abs(r1.position - r2.position);
  }
  // Vertical travel: walk to lift (pos-1) + lift time (floor diff * 2) + walk from lift (pos-1)
  // Assuming position 1 is closest to lift
  return (r1.position - 1) + (r2.position - 1) + (Math.abs(r1.floor - r2.floor) * 2);
};

// Helper to calculate total path cost for a set of rooms
const calculateTotalPathCost = (rooms) => {
  if (rooms.length <= 1) return 0;
  // Sort by floor then position to simulate a logical traversal
  const sorted = [...rooms].sort((a, b) => {
    if (a.floor !== b.floor) return a.floor - b.floor;
    return a.position - b.position;
  });

  let totalCost = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    totalCost += getTravelTime(sorted[i], sorted[i + 1]);
  }
  return totalCost;
};

// @desc    Book rooms with optimal placement
// @route   POST /api/bookings
// @access  Private
const bookRooms = async (req, res) => {
  try {
    const { numRooms, checkInDate, checkOutDate } = req.body;
    const userId = req.user.userId;

    if (!numRooms || numRooms < 1 || numRooms > 5) {
      return res.status(400).json({ success: false, message: 'Number of rooms must be between 1 and 5' });
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24)) || 1;

    // 1. Get all available rooms
    const availableRooms = await Room.findAll({
      where: { status: 'not-booked' },
      order: [['floor', 'ASC'], ['position', 'ASC']]
    });

    if (availableRooms.length < numRooms) {
      return res.status(400).json({ success: false, message: 'Not enough rooms available' });
    }

    let selectedRooms = [];
    let bestScore = Infinity;

    // Priority 1: Check Same Floor Availability
    const roomsByFloor = {};
    availableRooms.forEach(r => {
      if (!roomsByFloor[r.floor]) roomsByFloor[r.floor] = [];
      roomsByFloor[r.floor].push(r);
    });

    for (const floor in roomsByFloor) {
      const floorRooms = roomsByFloor[floor]; // already sorted by pos
      if (floorRooms.length >= numRooms) {
        // Find best contiguous/close segment on this floor
        // Since they are sorted by position, a sliding window of size N minimizes the spread
        for (let i = 0; i <= floorRooms.length - numRooms; i++) {
          const subset = floorRooms.slice(i, i + numRooms);
          // For same floor, cost matches spread: MaxPos - MinPos
          const score = subset[subset.length - 1].position - subset[0].position;

          if (score < bestScore) {
            bestScore = score;
            selectedRooms = subset;
          }
        }
      }
    }

    // Priority 2: If no same-floor solution found
    if (selectedRooms.length === 0) {
      // Multi-floor optimization: Minimize total travel time (Horizontal + Vertical)

      let bestClusterScore = Infinity;

      for (let i = 0; i < availableRooms.length; i++) {
        const seed = availableRooms[i];

        // Calculate distance from seed to all others
        const neighbors = availableRooms.map(r => ({
          room: r,
          dist: getTravelTime(seed, r)
        }));

        // Sort by distance from seed
        neighbors.sort((a, b) => a.dist - b.dist);

        // Take top N candidates
        const candidates = neighbors.slice(0, numRooms).map(n => n.room);

        if (candidates.length === numRooms) {
          // Calculate the specific traversal cost for this cluster
          const clusterScore = calculateTotalPathCost(candidates);

          if (clusterScore < bestClusterScore) {
            bestClusterScore = clusterScore;
            selectedRooms = candidates;
          }
        }
      }
      bestScore = bestClusterScore;
    }

    if (selectedRooms.length === 0) {
      return res.status(400).json({ success: false, message: 'Could not find a suitable set of rooms' });
    }

    const roomNumbers = selectedRooms.map(room => room.roomNumber);
    const totalPrice = parseFloat((numRooms * selectedRooms[0].basePrice * nights).toFixed(2));

    const booking = await Booking.create({
      userId,
      rooms: roomNumbers,
      totalRooms: numRooms,
      travelTime: bestScore,
      totalPrice,
      checkInDate,
      checkOutDate,
      status: 'confirmed'
    });

    await Room.update({ status: 'booked' }, { where: { roomNumber: roomNumbers } });

    res.status(201).json({
      success: true,
      message: 'Booking successful!',
      data: {
        ...booking.toJSON(),
        rooms: selectedRooms
      }
    });

  } catch (error) {
    console.error('❌ Booking error:', error);
    res.status(500).json({ success: false, message: 'Booking failed' });
  }
};

// @desc    Get user bookings
const getUserBookings = async (req, res) => {
  try {
    const userId = req.user.userId;
    const bookings = await Booking.findAll({
      where: { userId: userId },
      order: [['createdAt', 'DESC']]
    });
    const user = await User.findByPk(userId, { attributes: ['name', 'email', 'phone'] });

    res.json({
      success: true,
      data: bookings.map(b => ({ ...b.toJSON(), user }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
};

const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findOne({ where: { bookingId: id, userId: req.user.userId } });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, data: booking });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findOne({ where: { bookingId: id, userId: req.user.userId } });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    booking.status = 'cancelled';
    await booking.save();

    await Room.update({ status: 'not-booked' }, { where: { roomNumber: booking.rooms } });

    res.json({ success: true, message: 'Booking cancelled successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Cancel failed' });
  }
};

const getBookingStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const total = await Booking.count({ where: { userId } });
    const confirmed = await Booking.count({ where: { userId, status: 'confirmed' } });
    const cancelled = await Booking.count({ where: { userId, status: 'cancelled' } });
    res.json({ success: true, data: { total, confirmed, cancelled } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Stats failed' });
  }
};

module.exports = {
  bookRooms,
  getUserBookings,
  getBookingById,
  cancelBooking,
  getBookingStats
};