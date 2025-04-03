// server/routes/categoryRoutes.js
const express = require('express');
const categoryController = require('../controllers/categoryController'); // Import controller functions

const router = express.Router(); // Create an Express router instance

// Define routes and link them to controller functions
// GET request to '/' (relative to the path defined in server.js, which will be /api/categories)
router.get('/', categoryController.getAllCategories);

// We can add more routes here later (e.g., POST '/', PUT '/:id', DELETE '/:id')

module.exports = router; // Export the router