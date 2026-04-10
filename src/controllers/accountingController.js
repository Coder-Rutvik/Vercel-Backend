const { sequelize } = require('../config/database');
const { Bill, Expense, Booking } = require('../models');
const { Op } = require('sequelize');

// @desc Add a new Expense (Salary, Food Cost, Maintenance)
// @route POST /api/accounting/expense
// @access Private (Admin/Manager)
exports.addExpense = async (req, res) => {
  try {
    const { category, amount, description, date } = req.body;
    
    // SECURITY FIX: Prevent "Negative Expense" Exploit (which would illegally increase Profit)
    if (amount === undefined || amount < 0) {
      return res.status(400).json({ success: false, message: 'Expense amount cannot be negative or missing' });
    }

    const expense = await Expense.create({
      category,
      amount,
      description,
      date: date || new Date(),
      addedBy: req.user ? req.user.userId : null
    });
    res.status(201).json({ success: true, data: expense, message: 'Expense saved' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get Profit/Loss Dashboard Metrics
// @route GET /api/accounting/dashboard
// @access Private (Admin/Manager)
exports.getDashboardMetrics = async (req, res) => {
  try {
    // MEMORY CRASH FIX (OOM): Replaced findAll() with SQL Aggregations (SUM)
    // Loading 1,000,000 bills into Node RAM would crash the server. This does it at DB level!
    
    const [totalRoomRevenue, totalFoodRevenue, totalTaxCollected] = await Promise.all([
      Bill.sum('roomTotal', { where: { isPaid: true } }).then(val => val || 0),
      Bill.sum('foodTotal', { where: { isPaid: true } }).then(val => val || 0),
      Bill.sum('taxAmount', { where: { isPaid: true } }).then(val => val || 0)
    ]);

    const grossIncome = totalRoomRevenue + totalFoodRevenue;

    // Aggregate Expenses directly using SQL
    const totalExpenses = await Expense.sum('amount').then(val => val || 0);

    const expensesGrouped = await Expense.findAll({
      attributes: ['category', [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount']],
      group: ['category']
    });

    const expensesByCategory = {};
    expensesGrouped.forEach(exp => {
      expensesByCategory[exp.category] = parseFloat(exp.get('totalAmount'));
    });

    const finalProfit = grossIncome - totalExpenses;

    res.status(200).json({
      success: true,
      data: {
        revenue: {
          total: grossIncome,
          breakdown: {
            room: totalRoomRevenue,
            food: totalFoodRevenue
          },
          taxCollected: totalTaxCollected
        },
        expenses: {
          total: totalExpenses,
          breakdown: expensesByCategory
        },
        profit: finalProfit
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get Advanced Reports & RevPAR
// @route GET /api/accounting/reports
// @access Private (Admin)
exports.getAdvancedReports = async (req, res) => {
  try {
    const { Order, Room, Booking } = require('../models');
    
    // 1. Top Selling Dishes
    const orders = await Order.findAll();
    const dishCounts = {};
    orders.forEach(o => {
      (o.items || []).forEach(item => {
        dishCounts[item.name] = (dishCounts[item.name] || 0) + item.quantity;
      });
    });
    const topDishes = Object.entries(dishCounts).sort((a,b) => b[1] - a[1]).slice(0,5);

    // 2. Occupancy Rate & RevPAR
    const totalRooms = await Room.count();
    const bookedRooms = await Room.count({ where: { status: 'booked' } });
    const occupancyRate = totalRooms > 0 ? ((bookedRooms / totalRooms) * 100).toFixed(2) : 0;

    const paidBills = await require('../models').Bill.findAll({ where: { isPaid: true } });
    let totalRoomRevenue = 0;
    paidBills.forEach(b => totalRoomRevenue += parseFloat(b.roomTotal));
    // RevPAR = Total Room Revenue / Total Available Rooms (simplified for all-time dataset)
    const revPAR = totalRooms > 0 ? (totalRoomRevenue / totalRooms).toFixed(2) : 0;

    res.status(200).json({
      success: true,
      data: {
        topDishes: topDishes.map(d => ({ name: d[0], sold: d[1] })),
        occupancyRate: `${occupancyRate}%`,
        revPAR: `₹${revPAR}`
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc Get revenue + booking trend data for charts
// @route GET /api/accounting/trends
// @access Private (Admin/Manager)
exports.getTrendAnalytics = async (req, res) => {
  try {
    const requestedDays = parseInt(req.query.days || '14', 10);
    const days = Number.isFinite(requestedDays)
      ? Math.min(Math.max(requestedDays, 7), 60)
      : 14;

    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() - (days - 1));

    const [paidBills, bookings] = await Promise.all([
      Bill.findAll({
        where: {
          isPaid: true,
          createdAt: { [Op.gte]: startDate }
        },
        attributes: ['grandTotal', 'createdAt']
      }),
      Booking.findAll({
        where: {
          createdAt: { [Op.gte]: startDate },
          status: { [Op.in]: ['confirmed', 'completed'] }
        },
        attributes: ['createdAt']
      })
    ]);

    const labels = [];
    const revenueMap = new Map();
    const bookingMap = new Map();

    for (let i = 0; i < days; i += 1) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      labels.push(key);
      revenueMap.set(key, 0);
      bookingMap.set(key, 0);
    }

    paidBills.forEach((bill) => {
      const key = new Date(bill.createdAt).toISOString().slice(0, 10);
      if (!revenueMap.has(key)) return;
      const prev = revenueMap.get(key) || 0;
      revenueMap.set(key, prev + (parseFloat(bill.grandTotal) || 0));
    });

    bookings.forEach((booking) => {
      const key = new Date(booking.createdAt).toISOString().slice(0, 10);
      if (!bookingMap.has(key)) return;
      const prev = bookingMap.get(key) || 0;
      bookingMap.set(key, prev + 1);
    });

    res.status(200).json({
      success: true,
      data: {
        days,
        labels,
        revenueSeries: labels.map((k) => parseFloat((revenueMap.get(k) || 0).toFixed(2))),
        bookingSeries: labels.map((k) => bookingMap.get(k) || 0)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
