const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin', 'manager'));

router.post('/seed-demo', inventoryController.seedDemoInventory);
router.post('/', inventoryController.addOrUpdateInventory);
router.get('/', inventoryController.getInventory);

module.exports = router;
