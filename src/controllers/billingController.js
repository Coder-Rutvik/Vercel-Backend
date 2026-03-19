const { Bill, Booking, Room, Order, User } = require('../models');
const { Op } = require('sequelize');

// @desc Generate or Get Bill for a Booking (Checkout Process)
// @route GET /api/billing/:bookingId
// @access Private
exports.generateBill = async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    // Find booking
    const booking = await Booking.findByPk(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    // Calculate nights and room total
    const checkIn = new Date(booking.checkInDate);
    const checkOut = new Date(booking.checkOutDate);
    // If checking out today before checkOutDate or after, we can dynamically adjust. But standard is booking.totalPrice:
    const roomTotal = booking.totalPrice || 0;

    // Get all orders assigned to this booking that are added-to-room and not cancelled
    const orders = await Order.findAll({
      where: {
        bookingId: bookingId,
        paymentStatus: 'added-to-room',
        status: { [Op.ne]: 'cancelled' }
      }
    });

    let foodTotal = 0;
    orders.forEach(o => { foodTotal += parseFloat(o.totalPrice); });

    // Check if bill already generated
    let bill = await Bill.findOne({ where: { bookingId } });

    const gstPercentage = 18.00;
    const subtotal = parseFloat(roomTotal) + foodTotal;
    const taxAmount = (subtotal * gstPercentage) / 100;
    const grandTotal = subtotal + taxAmount;

    if (!bill) {
      bill = await Bill.create({
        bookingId,
        roomTotal,
        foodTotal,
        otherCharges: 0,
        gstPercentage,
        taxAmount,
        grandTotal,
        paymentMode: 'pending',
        isPaid: false
      });
    } else {
      // Update the bill just in case new orders were added
      bill.foodTotal = foodTotal;
      bill.taxAmount = taxAmount;
      bill.grandTotal = grandTotal;
      await bill.save();
    }

    res.status(200).json({ success: true, data: { bill, orders, booking } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Complete Checkout (Pay Bill)
// @route POST /api/billing/:bookingId/pay
// @access Private
exports.payAndCheckout = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { paymentMode } = req.body; // cash, upi, card
    
    const bill = await Bill.findOne({ where: { bookingId } });
    if (!bill) return res.status(404).json({ success: false, message: 'Bill not generated yet' });

    const { sequelize } = require('../config/database');
    const HousekeepingTask = require('../models/HousekeepingTask');
    
    const result = await sequelize.transaction(async (t) => {
      // 1. Mark bill as paid
      bill.isPaid = true;
      bill.paymentMode = paymentMode || 'cash';
      await bill.save({ transaction: t });

      // 2. Mark booking as completed
      const booking = await Booking.findByPk(bookingId, { transaction: t });
      booking.status = 'completed';
      await booking.save({ transaction: t });

      // 3. Free the rooms
      await Room.update(
        { status: 'not-booked' }, 
        { where: { roomNumber: { [Op.in]: booking.rooms } }, transaction: t }
      );
      
      // 4. AUTOMATION (Housekeeping)
      for (let currentRoom of booking.rooms) {
        await HousekeepingTask.create({
          roomNumber: currentRoom,
          status: 'dirty',
          priority: 'high'
        }, { transaction: t });
      }

      // 5. CRM (Loyalty points)
      const loyaltyEarned = Math.floor(parseFloat(bill.grandTotal) / 100) * 10;
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

      return bill;
    });

    res.status(200).json({ success: true, message: 'Checkout successful & Paid! Transaction committed atomically.', data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Checkout failed, completely rolled back: ' + error.message });
  }
};
