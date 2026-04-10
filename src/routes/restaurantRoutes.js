const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');
const { protect, authorize } = require('../middleware/auth');

// Menu Routes
router.post('/menu', protect, authorize('admin', 'manager'), restaurantController.addMenuItem);
router.get('/menu', restaurantController.getMenu); // Anyone can see

// KOT / Order Routes
router.post('/order', protect, restaurantController.createOrder); // Guest or Reception
router.get('/orders/active', protect, authorize('admin', 'manager', 'kitchen'), restaurantController.getActiveOrders);
router.put('/order/:id/status', protect, authorize('admin', 'manager', 'kitchen'), restaurantController.updateOrderStatus);

module.exports = router;
