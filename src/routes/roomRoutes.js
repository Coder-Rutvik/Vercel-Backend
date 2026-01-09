const express = require('express');
const router = express.Router();
const {
  getAllRooms,
  getAvailableRooms,
  getRoomsByFloor,
  getRoomByNumber,
  getRoomTypes,
  searchRooms,
  generateRandomOccupancy,
  resetAllBookings
} = require('../controllers/roomController');
const { roomSearchValidation } = require('../middleware/validation');
const { protect } = require('../middleware/auth');

router.get('/', getAllRooms);
router.get('/available', getAvailableRooms);
router.get('/types', getRoomTypes);
router.get('/search', roomSearchValidation, searchRooms);
router.get('/floor/:floorNumber', getRoomsByFloor);
router.get('/number/:roomNumber', getRoomByNumber);

// Protected routes for random and reset
router.post('/random-occupancy', protect, generateRandomOccupancy);
router.post('/reset-all', protect, resetAllBookings);

module.exports = router;