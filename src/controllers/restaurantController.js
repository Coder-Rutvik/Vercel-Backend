const { MenuItem, Order, Booking } = require('../models');
const { Op } = require('sequelize');
const inventoryController = require('./inventoryController');

const addDeduction = (map, name, amount) => {
  if (!name) return;
  const value = parseFloat(amount);
  if (!Number.isFinite(value) || value <= 0) return;
  map.set(name, (map.get(name) || 0) + value);
};

const getInventoryDeductionsFromItems = (items = []) => {
  const deductions = new Map();

  items.forEach((item) => {
    const itemName = String(item.name || '').toLowerCase();
    const qty = Math.max(1, parseInt(item.quantity || 1, 10));

    if (itemName.includes('water bottle')) addDeduction(deductions, 'Water Bottle 500ml', 1 * qty);
    if (itemName.includes('mineral water')) addDeduction(deductions, 'Mineral Water 1ltr', 1 * qty);

    if (itemName.includes('cold drink') && itemName.includes('small')) {
      addDeduction(deductions, 'Cold Drink â€” Small (200ml)', 1 * qty);
    } else if (itemName.includes('cold drink') && itemName.includes('medium')) {
      addDeduction(deductions, 'Cold Drink â€” Medium (300ml)', 1 * qty);
    } else if (itemName.includes('cold drink') && itemName.includes('large')) {
      addDeduction(deductions, 'Cold Drink â€” Large (600ml)', 1 * qty);
    }

    if (itemName.includes('masala chai')) {
      addDeduction(deductions, 'Milk', 0.2 * qty);
      addDeduction(deductions, 'Tea premix', 0.012 * qty);
      addDeduction(deductions, 'Sugar', 0.015 * qty);
    }

    if (itemName.includes('cold coffee')) {
      addDeduction(deductions, 'Milk', 0.25 * qty);
      addDeduction(deductions, 'Sugar', 0.02 * qty);
      addDeduction(deductions, 'Ice cubes', 0.05 * qty);
    }

    if (itemName.includes('fresh lime soda')) {
      addDeduction(deductions, 'Sugar', 0.012 * qty);
      addDeduction(deductions, 'Ice cubes', 0.04 * qty);
    }
  });

  return Array.from(deductions.entries()).map(([name, amount]) => ({
    name,
    amount: parseFloat(amount.toFixed(3))
  }));
};

/** Baseline menu: merged into DB when names are missing (Order Food → KOT → Billing chain). */
const DEFAULT_MENU_ITEMS = [
  { name: 'Paneer Butter Masala', category: 'Indian', price: 250, type: 'veg', isAvailable: true },
  { name: 'Dal Tadka', category: 'Indian', price: 180, type: 'veg', isAvailable: true },
  { name: 'Veg Biryani', category: 'Indian', price: 220, type: 'veg', isAvailable: true },
  { name: 'Butter Naan (2 pcs)', category: 'Indian', price: 80, type: 'veg', isAvailable: true },
  { name: 'Chicken Tikka', category: 'Indian', price: 350, type: 'non-veg', isAvailable: true },
  { name: 'Butter Chicken', category: 'Indian', price: 320, type: 'non-veg', isAvailable: true },
  { name: 'Chicken Biryani', category: 'Indian', price: 280, type: 'non-veg', isAvailable: true },
  { name: 'Hakka Noodles', category: 'Chinese', price: 180, type: 'veg', isAvailable: true },
  { name: 'Veg Manchurian', category: 'Chinese', price: 200, type: 'veg', isAvailable: true },
  { name: 'Chicken Fried Rice', category: 'Chinese', price: 240, type: 'non-veg', isAvailable: true },
  { name: 'Margherita Pizza', category: 'Italian', price: 300, type: 'veg', isAvailable: true },
  { name: 'French Fries', category: 'Snacks', price: 120, type: 'veg', isAvailable: true },
  { name: 'Water Bottle 500ml', category: 'Beverages', price: 20, type: 'veg', isAvailable: true },
  { name: 'Mineral Water 1L', category: 'Beverages', price: 30, type: 'veg', isAvailable: true },
  { name: 'Cold Drink — Small (200ml)', category: 'Beverages', price: 40, type: 'veg', isAvailable: true },
  { name: 'Cold Drink — Medium (300ml)', category: 'Beverages', price: 55, type: 'veg', isAvailable: true },
  { name: 'Cold Drink — Large (600ml)', category: 'Beverages', price: 75, type: 'veg', isAvailable: true },
  { name: 'Cold Coffee', category: 'Beverages', price: 80, type: 'veg', isAvailable: true },
  { name: 'Masala Chai', category: 'Beverages', price: 40, type: 'veg', isAvailable: true },
  { name: 'Fresh Lime Soda', category: 'Beverages', price: 60, type: 'veg', isAvailable: true },
];

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
    let menu = await MenuItem.findAll({ order: [['category', 'ASC'], ['name', 'ASC']] });

    const existingNames = new Set(menu.map((m) => m.name));
    const missing = DEFAULT_MENU_ITEMS.filter((d) => !existingNames.has(d.name));
    if (missing.length > 0) {
      console.log(`🍽️ Adding ${missing.length} default menu item(s)…`);
      await MenuItem.bulkCreate(missing);
      menu = await MenuItem.findAll({ order: [['category', 'ASC'], ['name', 'ASC']] });
    }

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

    // SECURITY CHECK 1: Ensure the Booking is actually "confirmed" (Active) before charging it
    if (bookingId) {
      const activeBooking = await Booking.findOne({ where: { bookingId, status: 'confirmed' } });
      if (!activeBooking) {
        return res.status(400).json({ success: false, message: 'Invalid or Inactive Booking ID. You cannot add food to a checked-out or cancelled room.' });
      }
    }

    // SECURITY CHECK 2: Prevent Client-Side Price Spoofing
    // We MUST NOT trust the "price" sent by the frontend API request (could be manipulated via Postman/DevTools)
    let authenticTotalPrice = 0;
    const authenticItems = [];

    for (const item of items) {
      const itemId = item.menuItemId || item.id;
      const dbItem = await MenuItem.findByPk(itemId);
      
      if (!dbItem) {
        return res.status(404).json({ success: false, message: `Menu Item missing or invalid in Database` });
      }
      
      if (!dbItem.isAvailable) {
        return res.status(400).json({ success: false, message: `Item ${dbItem.name} is currently out of stock` });
      }

      const realPrice = parseFloat(dbItem.price);
      const quantity = parseInt(item.quantity) || 1;
      
      authenticTotalPrice += (realPrice * quantity);

      // Rebuilding the item array with trusted Backend data + User special notes!
      authenticItems.push({
        menuItemId: dbItem.id,
        name: dbItem.name,
        price: realPrice,
        quantity: quantity,
        notes: item.notes || ""
      });
    }

    const order = await Order.create({
      bookingId: bookingId || null,
      tableNumber: tableNumber || null,
      items: authenticItems,
      totalPrice: authenticTotalPrice,
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
        status: { [Op.in]: ['pending', 'preparing', 'prepared'] }
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

    const previousStatus = order.status;
    order.status = status;
    await order.save();

    let inventoryImpact = null;
    if (
      status === 'prepared' &&
      previousStatus !== 'prepared' &&
      previousStatus !== 'delivered'
    ) {
      const deductions = getInventoryDeductionsFromItems(order.items || []);
      inventoryImpact = await inventoryController.deductInventory(deductions, {
        trigger: 'order_prepared',
        orderId: order.orderId,
        userId: req.user?.userId || null
      });
    }

    if (req.app.get('io')) {
      req.app.get('io').emit('order-updated', order);
      if (status === 'prepared') {
        req.app.get('io').emit('order-ready', {
          orderId: order.orderId,
          bookingId: order.bookingId || null,
          tableNumber: order.tableNumber || null
        });
      }
      if (inventoryImpact && Array.isArray(inventoryImpact.lowStockItems) && inventoryImpact.lowStockItems.length > 0) {
        req.app.get('io').emit('low-stock-alert', {
          count: inventoryImpact.lowStockItems.length,
          items: inventoryImpact.lowStockItems
        });
      }
    }

    res.status(200).json({
      success: true,
      data: order,
      inventoryImpact: inventoryImpact || { deducted: [], lowStockItems: [] }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
