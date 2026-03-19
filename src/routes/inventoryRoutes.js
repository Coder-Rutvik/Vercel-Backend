const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { protect } = require('../middleware/auth');

router.post('/', inventoryController.addOrUpdateInventory);
router.get('/', inventoryController.getInventory);

module.exports = router;
