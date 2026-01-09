const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  bookRooms,
  getUserBookings,
  getBookingById,
  cancelBooking,
  getBookingStats
} = require('../controllers/bookingController');

// All routes require authentication
router.use(protect);

// ✅ REMOVE bookingValidation middleware (तुमच्या validation मध्ये problem आहे)
router.post('/', bookRooms); // Simple validation inside controller

router.get('/my-bookings', getUserBookings);
router.get('/stats', getBookingStats);
router.get('/:id', getBookingById);
router.put('/:id/cancel', cancelBooking);

module.exports = router;