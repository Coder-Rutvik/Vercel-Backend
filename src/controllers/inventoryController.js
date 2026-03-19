const { InventoryItem, AuditLog } = require('../models');

// @desc Add / Update Inventory Item
// @route POST /api/inventory
// @access Private (Admin/Manager)
exports.addOrUpdateInventory = async (req, res) => {
  try {
    const { name, stockUnit, currentStock, lowStockThreshold } = req.body;
    let item = await InventoryItem.findOne({ where: { name } });

    if (item) {
      const oldStock = item.currentStock;
      item.currentStock = parseFloat(item.currentStock) + parseFloat(currentStock);
      if (lowStockThreshold) item.lowStockThreshold = lowStockThreshold;
      await item.save();

      // Create Audit Log
      await AuditLog.create({
        action: 'UPDATE_INVENTORY',
        details: { item: name, oldStock, newStock: item.currentStock },
        userId: req.user ? req.user.userId : null
      });

    } else {
      item = await InventoryItem.create({
        name, stockUnit, currentStock, lowStockThreshold
      });

       // Create Audit Log
       await AuditLog.create({
        action: 'ADD_INVENTORY',
        details: { item: name, stock: currentStock },
        userId: req.user ? req.user.userId : null
      });
    }

    res.status(200).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get All Inventory
// @route GET /api/inventory
// @access Private
exports.getInventory = async (req, res) => {
  try {
    const items = await InventoryItem.findAll({ order: [['currentStock', 'ASC']] });
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Deduct Inventory (Called when Food Order is Prepared)
// Note: In real life this would be mapped to Recipes. For MVP, we pass array of deductions.
exports.deductInventory = async (deductions) => {
  try {
    for (let ded of deductions) {
      const item = await InventoryItem.findOne({ where: { name: ded.name } });
      if (item) {
        item.currentStock = item.currentStock - ded.amount;
        await item.save();
      }
    }
  } catch (err) {
    console.error('Failed to deduct inventory', err);
  }
};
