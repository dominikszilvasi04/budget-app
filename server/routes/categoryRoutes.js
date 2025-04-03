// server/routes/categoryRoutes.js
const express = require('express');
const categoryController = require('../controllers/categoryController');

const router = express.Router();

// GET /api/categories/
router.get('/', categoryController.getAllCategories);

// POST /api/categories/  <-- Add this route
router.post('/', categoryController.addCategory);

module.exports = router;