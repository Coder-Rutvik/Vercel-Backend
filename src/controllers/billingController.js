const { Bill, Booking, Room, Order, User } = require('../models');
const { Op } = require('sequelize');
const PDFGenerator = require('../utils/pdfGenerator');

const canAccessBooking = (reqUser, booking) => {
  if (!reqUser || !booking) return false;
  if (reqUser.role === 'admin' || reqUser.role === 'manager') return true;
  return String(reqUser.userId) === String(booking.userId);
};

const buildBillContext = async (bookingId) => {
  const booking = await Booking.findByPk(bookingId);
  if (!booking) {
    const err = new Error('Booking not found');
    err.statusCode = 404;
    throw err;
  }

  const roomTotal = parseFloat(booking.totalPrice);
  const safeRoomTotal = Number.isFinite(roomTotal) ? roomTotal : 0;

  const orders = await Order.findAll({
    where: {
      bookingId,
      paymentStatus: 'added-to-room',
      status: { [Op.notIn]: ['cancelled'] }
    }
  });

  let foodTotal = 0;
  orders.forEach((o) => {
    const t = parseFloat(o.totalPrice);
    if (Number.isFinite(t)) foodTotal += t;
  });

  let bill = await Bill.findOne({ where: { bookingId } });

  const gstPercentage = 18.0;
  const subtotal = safeRoomTotal + foodTotal;
  const taxAmount = parseFloat(((subtotal * gstPercentage) / 100).toFixed(2));
  const grandTotal = parseFloat((subtotal + taxAmount).toFixed(2));

  if (!bill) {
    bill = await Bill.create({
      bookingId,
      roomTotal: safeRoomTotal,
      foodTotal,
      otherCharges: 0,
      gstPercentage,
      taxAmount,
      grandTotal,
      paymentMode: 'pending',
      isPaid: false
    });
  } else {
    bill.roomTotal = safeRoomTotal;
    bill.foodTotal = foodTotal;
    bill.taxAmount = taxAmount;
    bill.grandTotal = grandTotal;
    await bill.save();
  }

  return { booking, bill, orders };
};

// @desc Generate or Get Bill for a Booking (Checkout Process)
// @route GET /api/billing/:bookingId
// @access Private
exports.generateBill = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await Booking.findByPk(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (!canAccessBooking(req.user, booking)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this booking bill' });
    }

    const { bill, orders } = await buildBillContext(bookingId);

    const plainBill = bill.get ? bill.get({ plain: true }) : bill;
    const plainBooking = booking.get ? booking.get({ plain: true }) : booking;
    const plainOrders = orders.map((o) => (o.get ? o.get({ plain: true }) : o));

    res.status(200).json({
      success: true,
      data: { bill: plainBill, orders: plainOrders, booking: plainBooking }
    });
  } catch (error) {
    console.error('generateBill:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to build bill' });
  }
};

// @desc Download invoice PDF
// @route GET /api/billing/:bookingId/invoice-pdf
// @access Private
exports.downloadInvoicePdf = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findByPk(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (!canAccessBooking(req.user, booking)) {
      return res.status(403).json({ success: false, message: 'Not authorized to download this invoice' });
    }

    const { bill, orders } = await buildBillContext(bookingId);
    const user = await User.findByPk(booking.userId, {
      attributes: ['userId', 'name', 'email', 'phone']
    });
    const rooms = await Room.findAll({
      where: { roomNumber: { [Op.in]: booking.rooms || [] } },
      order: [['roomNumber', 'ASC']]
    });

    const pdfBuffer = await PDFGenerator.generateCombinedBillInvoice({
      booking: booking.get ? booking.get({ plain: true }) : booking,
      bill: bill.get ? bill.get({ plain: true }) : bill,
      user: user ? (user.get ? user.get({ plain: true }) : user) : null,
      rooms: rooms.map((r) => (r.get ? r.get({ plain: true }) : r)),
      orders: orders.map((o) => (o.get ? o.get({ plain: true }) : o))
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice-${String(booking.bookingId).slice(0, 8)}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error('downloadInvoicePdf:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to generate invoice PDF' });
  }
};

// @desc Complete Checkout (Pay Bill)
exports.payAndCheckout = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { paymentMode } = req.body; // cash, upi, card
    
    const { sequelize } = require('../config/database');
    const HousekeepingTask = require('../models/HousekeepingTask');
    let loyaltyEarned = 0;
    
    // Idempotency & Database Atomicity Start
    const result = await sequelize.transaction(async (t) => {
      
      // Fetch Bill INSIDE transaction with lock (optional, but fetching inside is must)
      const bill = await Bill.findOne({ 
        where: { bookingId }, 
        transaction: t 
      });
      
      if (!bill) throw new Error('Bill not generated yet');
      
      // ✅ IDEMPOTENCY FIX: Prevent Double Checkout / Double Loyalty Points / Double Tasks
      if (bill.isPaid) {
        throw new Error('This bill is already paid and checkout is completed.');
      }

      // 1. Mark bill as paid
      bill.isPaid = true;
      bill.paymentMode = paymentMode || 'cash';
      await bill.save({ transaction: t });

      // 2. Mark booking as completed
      const booking = await Booking.findByPk(bookingId, { transaction: t });
      if (!booking) throw new Error('Booking not found');
      if (!canAccessBooking(req.user, booking)) {
        const authError = new Error('Not authorized to checkout this booking');
        authError.statusCode = 403;
        throw authError;
      }
      booking.status = 'completed';
      await booking.save({ transaction: t });

      // 3. Free the rooms
      await Room.update(
        { status: 'not-booked' }, 
        { where: { roomNumber: { [Op.in]: booking.rooms } }, transaction: t }
      );
      
      // 4. AUTOMATION (Housekeeping) - Only happens once because of the isPaid check
      for (let currentRoom of booking.rooms) {
        await HousekeepingTask.create({
          roomNumber: currentRoom,
          status: 'dirty',
          priority: 'high'
        }, { transaction: t });
      }

      // 5. CRM (Loyalty points) - Only incremented ONCE
      loyaltyEarned = Math.floor((parseFloat(bill.grandTotal) || 0) * 0.15);
      const user = await User.findByPk(booking.userId, { transaction: t });
      if (user) {
        user.loyaltyPoints = (user.loyaltyPoints || 0) + loyaltyEarned;
        await user.save({ transaction: t });
      }

      // 6. Mark KOT orders as paid
      await Order.update(
        { paymentStatus: 'paid' }, 
        { where: { bookingId }, transaction: t }
      );

      return { bill, loyaltyEarned };
    });

    res.status(200).json({
      success: true,
      message: 'Checkout successful & Paid! Transaction committed atomically.',
      data: {
        bill: result.bill,
        loyaltyPointsEarned: result.loyaltyEarned
      }
    });
  } catch (error) {
    // If it's our custom logical error (already paid), return 400 Bad Request
    if (error.message === 'This bill is already paid and checkout is completed.' || error.message === 'Bill not generated yet') {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.statusCode === 403 || error.message === 'Not authorized to checkout this booking') {
      return res.status(403).json({ success: false, message: error.message });
    }
    
    res.status(500).json({ success: false, message: 'Checkout failed, completely rolled back: ' + error.message });
  }
};
