const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getAllUsers,
  getAllBookings,
  getSystemLogs,
  getAuditTrail,
  updateRoom,
  getDashboardStats
} = require('../controllers/adminController');

// All routes require admin authentication
router.use(protect);
router.use(authorize('admin'));

router.route('/users')
  .get(getAllUsers);

router.route('/bookings')
  .get(getAllBookings);

router.route('/stats')
  .get(getDashboardStats);

router.route('/rooms/:id')
  .put(updateRoom);

module.exports = router;