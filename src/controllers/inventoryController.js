const { InventoryItem, AuditLog } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

/** Demo stock: water, cold drinks (S/M/L), kitchen basics */
const DEMO_INVENTORY_ROWS = [
  { name: 'Water Bottle 500ml', stockUnit: 'pcs', currentStock: 150, lowStockThreshold: 30 },
  { name: 'Cold Drink — Small (200ml)', stockUnit: 'pcs', currentStock: 90, lowStockThreshold: 20 },
  { name: 'Cold Drink — Medium (300ml)', stockUnit: 'pcs', currentStock: 72, lowStockThreshold: 18 },
  { name: 'Cold Drink — Large (600ml)', stockUnit: 'pcs', currentStock: 48, lowStockThreshold: 12 },
  { name: 'Mineral Water 1ltr', stockUnit: 'pcs', currentStock: 60, lowStockThreshold: 15 },
  { name: 'Milk', stockUnit: 'ltr', currentStock: 22, lowStockThreshold: 5 },
  { name: 'Tea premix', stockUnit: 'kg', currentStock: 6, lowStockThreshold: 1.5 },
  { name: 'Sugar', stockUnit: 'kg', currentStock: 14, lowStockThreshold: 3 },
  { name: 'Ice cubes', stockUnit: 'kg', currentStock: 18, lowStockThreshold: 4 },
];

// @desc Add / Update Inventory Item
// @route POST /api/inventory
// @access Private (Admin/Manager)
exports.addOrUpdateInventory = async (req, res) => {
  try {
    const { name, stockUnit, currentStock, lowStockThreshold } = req.body;
    
    // ATOMIC FIX: Wrapping in transaction with UPDATE LOCK to prevent Race Conditions
    const resultItem = await sequelize.transaction(async (t) => {
      let item = await InventoryItem.findOne({ 
        where: { name }, 
        transaction: t, 
        lock: t.LOCK.UPDATE 
      });

      if (item) {
        const oldStock = item.currentStock;
        // Float sum
        item.currentStock = parseFloat(item.currentStock) + parseFloat(currentStock);
        if (lowStockThreshold) item.lowStockThreshold = lowStockThreshold;
        
        await item.save({ transaction: t });

        // Create Audit Log
        await AuditLog.create({
          action: 'UPDATE_INVENTORY',
          details: { item: name, oldStock, newStock: item.currentStock },
          userId: req.user ? req.user.userId : null
        }, { transaction: t });

      } else {
        item = await InventoryItem.create({
          name, stockUnit, currentStock, lowStockThreshold
        }, { transaction: t });

        // Create Audit Log
        await AuditLog.create({
          action: 'ADD_INVENTORY',
          details: { item: name, stock: currentStock },
          userId: req.user ? req.user.userId : null
        }, { transaction: t });
      }
      return item;
    });

    res.status(200).json({ success: true, data: resultItem });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Get All Inventory
// @route GET /api/inventory
// @access Private
exports.getInventory = async (req, res) => {
  try {
    const items = await InventoryItem.findAll({ order: [['name', 'ASC']] });
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Seed demo inventory (bottles, cold drinks, etc.) — idempotent unless replace=true
// @route POST /api/inventory/seed-demo
exports.seedDemoInventory = async (req, res) => {
  try {
    const replace = !!(req.body && req.body.replace);

    await sequelize.transaction(async (t) => {
      for (const row of DEMO_INVENTORY_ROWS) {
        const existing = await InventoryItem.findOne({
          where: { name: row.name },
          transaction: t,
          lock: t.LOCK.UPDATE
        });

        if (!existing) {
          await InventoryItem.create({ ...row }, { transaction: t });
          await AuditLog.create({
            action: 'ADD_INVENTORY',
            details: { item: row.name, stock: row.currentStock, demoSeed: true },
            userId: req.user ? req.user.userId : null
          }, { transaction: t });
        } else if (replace) {
          existing.currentStock = row.currentStock;
          existing.lowStockThreshold = row.lowStockThreshold;
          existing.stockUnit = row.stockUnit;
          await existing.save({ transaction: t });
          await AuditLog.create({
            action: 'UPDATE_INVENTORY',
            details: { item: row.name, demoSeedReplace: true, newStock: row.currentStock },
            userId: req.user ? req.user.userId : null
          }, { transaction: t });
        }
      }
    });

    const items = await InventoryItem.findAll({ order: [['name', 'ASC']] });
    res.status(200).json({
      success: true,
      data: items,
      message: replace
        ? 'Demo stock quantities reset where demo items exist.'
        : 'Demo items added (existing rows unchanged). Use replace:true to reset demo quantities.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc Deduct Inventory (Called when Food Order is Prepared)
// Note: In real life this would be mapped to Recipes. For MVP, we pass array of deductions.
exports.deductInventory = async (deductions, context = {}) => {
  try {
    if (!Array.isArray(deductions) || deductions.length === 0) {
      return { deducted: [], lowStockItems: [] };
    }

    const merged = new Map();
    deductions.forEach((d) => {
      const name = String(d.name || '').trim();
      const amount = parseFloat(d.amount || 0);
      if (!name || !Number.isFinite(amount) || amount <= 0) return;
      merged.set(name, (merged.get(name) || 0) + amount);
    });
    const normalizedDeductions = Array.from(merged.entries()).map(([name, amount]) => ({
      name,
      amount: parseFloat(amount.toFixed(3))
    }));

    await sequelize.transaction(async (t) => {
      for (const ded of normalizedDeductions) {
        await InventoryItem.decrement('currentStock', {
          by: ded.amount,
          where: { name: ded.name },
          transaction: t
        });

        await AuditLog.create({
          action: 'DEDUCT_INVENTORY',
          details: {
            item: ded.name,
            deducted: ded.amount,
            trigger: context.trigger || 'order_prepared',
            orderId: context.orderId || null
          },
          userId: context.userId || null
        }, { transaction: t });
      }
    });

    const touchedRows = await InventoryItem.findAll({
      where: { name: { [Op.in]: normalizedDeductions.map((d) => d.name) } }
    });

    const lowStockItems = touchedRows
      .filter((row) => (parseFloat(row.currentStock) || 0) <= (parseFloat(row.lowStockThreshold) || 0))
      .map((row) => ({
        name: row.name,
        currentStock: parseFloat(row.currentStock) || 0,
        lowStockThreshold: parseFloat(row.lowStockThreshold) || 0,
        stockUnit: row.stockUnit
      }));
    
    return { deducted: normalizedDeductions, lowStockItems };
  } catch (err) {
    console.error('Failed to deduct inventory', err);
    return { deducted: [], lowStockItems: [], error: err.message };
  }
};
