const { Bill, Expense } = require('../models');
const { Op } = require('sequelize');

// @desc Add a new Expense (Salary, Food Cost, Maintenance)
// @route POST /api/accounting/expense
// @access Private (Admin/Manager)
exports.addExpense = async (req, res) => {
  try {
    const { category, amount, description, date } = req.body;
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
    // We can filter by date range, but for MVP we get all or grouped by month/today
    // Let's get "All Time" and "Today"
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Revenue comes from Bills that are paid
    const paidBills = await Bill.findAll({ where: { isPaid: true } });
    
    let totalRoomRevenue = 0;
    let totalFoodRevenue = 0;
    let totalTaxCollected = 0;
    let totalRevenue = 0; // grandTotals

    paidBills.forEach(bill => {
      totalRoomRevenue += parseFloat(bill.roomTotal);
      totalFoodRevenue += parseFloat(bill.foodTotal);
      totalTaxCollected += parseFloat(bill.taxAmount);
      totalRevenue += parseFloat(bill.grandTotal);
    });

    // Expenses
    const allExpenses = await Expense.findAll();
    let totalExpenses = 0;
    const expensesByCategory = {};

    allExpenses.forEach(exp => {
      totalExpenses += parseFloat(exp.amount);
      if(!expensesByCategory[exp.category]) {
        expensesByCategory[exp.category] = 0;
      }
      expensesByCategory[exp.category] += parseFloat(exp.amount);
    });

    // Profit
    const netProfit = totalRevenue - totalExpenses - totalTaxCollected; // assuming tax goes to govt
    // Wait, grandTotal includes tax. If business pays tax to govt, real revenue is (grandTotal - taxAmount).
    // So real income is (totalRoomRevenue + totalFoodRevenue)
    const grossIncome = totalRoomRevenue + totalFoodRevenue;
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
