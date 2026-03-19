const express = require('express');
const router = express.Router();
const restaurantController = require('../controllers/restaurantController');
const { protect } = require('../middleware/auth'); // Add back 'authorize' if role-based is strictly needed now

// Menu Routes
router.post('/menu', protect, restaurantController.addMenuItem); // Ideally admin/manager only
router.get('/menu', restaurantController.getMenu); // Anyone can see

// KOT / Order Routes
router.post('/order', protect, restaurantController.createOrder); // Guest or Reception
router.get('/orders/active', protect, restaurantController.getActiveOrders); // Kitchen
router.put('/order/:id/status', protect, restaurantController.updateOrderStatus); // Kitchen

module.exports = router;
