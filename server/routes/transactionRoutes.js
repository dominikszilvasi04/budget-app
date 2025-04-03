// server/routes/transactionRoutes.js
const express = require('express');
const transactionController = require('../controllers/transactionController');

const router = express.Router();

// POST /api/transactions/
router.post('/', transactionController.addTransaction);

// GET /api/transactions/
router.get('/', transactionController.getAllTransactions);

// DELETE /api/transactions/:id  <-- Add this route
router.delete('/:id', transactionController.deleteTransaction);

module.exports = router;