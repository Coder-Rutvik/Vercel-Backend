const express = require('express');
const router = express.Router();
const accountingController = require('../controllers/accountingController');
const { protect, authorize } = require('../middleware/auth');

router.post('/expense', protect, authorize('admin', 'manager'), accountingController.addExpense);
router.get('/dashboard', protect, authorize('admin', 'manager'), accountingController.getDashboardMetrics);
router.get('/reports', protect, authorize('admin', 'manager'), accountingController.getAdvancedReports);
router.get('/trends', protect, authorize('admin', 'manager'), accountingController.getTrendAnalytics);

module.exports = router;
