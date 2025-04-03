// server/routes/categoryRoutes.js
const express = require('express');
const categoryController = require('../controllers/categoryController');

const router = express.Router();

// GET /api/categories/
router.get('/', categoryController.getAllCategories);
// POST /api/categories/
router.post('/', categoryController.addCategory);
// PUT /api/categories/:id  <-- Add this route
router.put('/:id', categoryController.updateCategory);
// DELETE /api/categories/:id <-- Add this route
router.delete('/:id', categoryController.deleteCategory);

module.exports = router;