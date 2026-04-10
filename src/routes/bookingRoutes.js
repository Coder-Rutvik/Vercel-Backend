const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { validateCreateBooking } = require('../validators/bookingValidator');
const {
  bookRooms,
  getUserBookings,
  getBookingById,
  cancelBooking,
  getBookingStats
} = require('../controllers/bookingController');

const rateLimit = require('express-rate-limit');

// Rate limiting for bookings (Idempotency and Anti-Spam)
const bookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 booking requests per completely 15 min
  message: { success: false, message: 'Too many booking attempts from your IP. Please wait 15 minutes to try again!' }
});

// All routes require authentication
router.use(protect);

router.post('/', bookingLimiter, validateCreateBooking, bookRooms);

router.get('/my-bookings', getUserBookings);
router.get('/stats', getBookingStats);
router.get('/:id', getBookingById);
router.put('/:id/cancel', cancelBooking);

module.exports = router;