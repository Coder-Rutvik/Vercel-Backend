const express = require('express');
const router = express.Router();
const proController = require('../controllers/proFeaturesController');
const { protect } = require('../middleware/auth');

router.post('/channel-webhook', proController.channelManagerSync); // Public webhook
router.get('/ai-demand', protect, proController.aiDemandPrediction);

module.exports = router;
