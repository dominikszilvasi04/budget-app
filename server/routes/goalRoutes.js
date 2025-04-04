// server/routes/goalRoutes.js
const express = require('express');
const goalController = require('../controllers/goalController');

const router = express.Router();

// GET /api/goals/
router.get('/', goalController.getAllGoals);
// POST /api/goals/
router.post('/', goalController.addGoal);
// POST /api/goals/:goalId/contributions
router.post('/:goalId/contributions', goalController.addContribution);

// --- NEW: Update and Delete Routes ---
// PUT /api/goals/:id
router.put('/:id', goalController.updateGoal);
// DELETE /api/goals/:id
router.delete('/:id', goalController.deleteGoal);
// --- End NEW ---

module.exports = router;