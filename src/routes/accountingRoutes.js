const express = require('express');
const router = express.Router();
const accountingController = require('../controllers/accountingController');
const { protect } = require('../middleware/auth'); // In future, add restrictTo('admin', 'manager')

router.post('/expense', protect, accountingController.addExpense); // Added restrict back optionally
router.get('/dashboard', protect, accountingController.getDashboardMetrics);
router.get('/reports', protect, accountingController.getAdvancedReports);

module.exports = router;
