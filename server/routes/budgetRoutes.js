const express = require('express');
const budgetController = require('../controllers/budgetController');

const router = express.Router();

router.get('/current', budgetController.getCurrentBudgets);
router.put('/set', budgetController.setBudget);

module.exports = router;