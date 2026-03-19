const { MenuItem, Order, Booking } = require('../models');

// @desc Add new item to Menu
// @route POST /api/restaurant/menu
// @access Private (Admin/Manager)
exports.addMenuItem = async (req, res) => {
  try {
    const { name, category, price, type, isAvailable } = req.body;
    const item = await MenuItem.create({ name, category, price, type, isAvailable });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get all Menu Items
// @route GET /api/restaurant/menu
// @access Public (or Logged In users)
exports.getMenu = async (req, res) => {
  try {
    const menu = await MenuItem.findAll({ order: [['category', 'ASC']] });
    res.status(200).json({ success: true, data: menu });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Create a Kitchen Order Ticket (KOT)
// @route POST /api/restaurant/order
// @access Private (Reception/Customer)
exports.createOrder = async (req, res) => {
  try {
    const { bookingId, tableNumber, items } = req.body;
    
    // items should be [{ menuItemId, name, quantity, price }]
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in order' });
    }

    let totalPrice = 0;
    items.forEach(item => {
      totalPrice += item.price * item.quantity;
    });

    const order = await Order.create({
      bookingId: bookingId || null,
      tableNumber: tableNumber || null,
      items,
      totalPrice,
      status: 'pending',
      paymentStatus: bookingId ? 'added-to-room' : 'unpaid'
    });

    // If socket.io is set up on app, emit to kitchen
    if (req.app.get('io')) {
      req.app.get('io').emit('new-order', order);
    }

    res.status(201).json({ success: true, data: order, message: 'Order sent to kitchen' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get all active orders (For Kitchen Dashboard)
// @route GET /api/restaurant/orders/active
// @access Private (Kitchen/Admin)
exports.getActiveOrders = async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: {
        status: ['pending', 'preparing', 'prepared']
      },
      order: [['createdAt', 'ASC']]
    });
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Update Order Status
// @route PUT /api/restaurant/order/:id/status
// @access Private (Kitchen/Admin)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByPk(req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.status = status;
    await order.save();

    if (req.app.get('io')) {
      req.app.get('io').emit('order-updated', order);
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
