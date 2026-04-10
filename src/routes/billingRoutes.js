const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { protect } = require('../middleware/auth');

router.get('/:bookingId', protect, billingController.generateBill);
router.get('/:bookingId/invoice-pdf', protect, billingController.downloadInvoicePdf);
router.post('/:bookingId/pay', protect, billingController.payAndCheckout);

module.exports = router;
