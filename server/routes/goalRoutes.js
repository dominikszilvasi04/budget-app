// server/routes/goalRoutes.js
const express = require('express');
const goalController = require('../controllers/goalController');

const router = express.Router();

// GET /api/goals/
router.get('/', goalController.getAllGoals);

// POST /api/goals/
router.post('/', goalController.addGoal);

// Future routes: PUT /:id, DELETE /:id, POST /:id/contributions

module.exports = router;