const express = require('express');
const transactionController = require('../controllers/transactionController');

const router = express.Router();

router.post('/', transactionController.addTransaction);
router.get('/', transactionController.getAllTransactions);
router.put('/:id', transactionController.updateTransaction);
router.delete('/:id', transactionController.deleteTransaction);
router.get('/insights/summary', transactionController.getTransactionInsights);
router.get('/export/csv', transactionController.exportTransactionsCsv);
router.post('/import/csv', transactionController.importTransactionsCsv);
router.get('/recurring/list', transactionController.getRecurringTransactions);
router.post('/recurring', transactionController.createRecurringTransaction);
router.put('/recurring/:id', transactionController.updateRecurringTransaction);
router.delete('/recurring/:id', transactionController.deleteRecurringTransaction);
router.post('/recurring/process', transactionController.processRecurringTransactions);

module.exports = router;