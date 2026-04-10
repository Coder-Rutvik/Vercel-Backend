const express = require('express');
const router = express.Router();
const proController = require('../controllers/proFeaturesController');
const { protect, authorize } = require('../middleware/auth');

router.post('/channel-webhook', proController.channelManagerSync); // Public webhook
router.get('/ai-demand', protect, authorize('admin', 'manager'), proController.aiDemandPrediction);

module.exports = router;
