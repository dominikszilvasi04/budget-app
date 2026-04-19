const express = require('express');
const goalController = require('../controllers/goalController');

const router = express.Router();

router.get('/', goalController.getAllGoals);
router.post('/', goalController.addGoal);
router.post('/:goalId/contributions', goalController.addContribution);
router.put('/:id', goalController.updateGoal);
router.delete('/:id', goalController.deleteGoal);

module.exports = router;