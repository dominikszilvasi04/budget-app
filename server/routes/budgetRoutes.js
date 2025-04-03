// server/routes/budgetRoutes.js
const express = require('express');
const budgetController = require('../controllers/budgetController');

const router = express.Router();

// GET /api/budgets/current (or just /api/budgets/)
router.get('/current', budgetController.getCurrentBudgets);

// POST or PUT /api/budgets/set (or just /api/budgets/)
// Using PUT often implies updating/creating a specific resource representation
router.put('/set', budgetController.setBudget);

module.exports = router;