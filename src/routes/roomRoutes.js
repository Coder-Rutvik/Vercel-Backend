const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { protect, authorize } = require('../middleware/auth');

// Public routes
router.get('/', roomController.getAllRooms);
router.get('/available', roomController.getAvailableRooms);
router.get('/floor/:floorNumber', roomController.getRoomsByFloor);
router.get('/number/:roomNumber', roomController.getRoomByNumber);
router.get('/types', roomController.getRoomTypes);
router.get('/search', roomController.searchRooms);

// Private routes
router.post('/random-occupancy', protect, roomController.generateRandomOccupancy);
router.post('/reset-all', protect, roomController.resetAllBookings);
router.post('/seed-rooms', protect, roomController.seedRooms); // ✅ NEW ROUTE

module.exports = router;