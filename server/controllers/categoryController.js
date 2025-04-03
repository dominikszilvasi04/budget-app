// server/controllers/categoryController.js
const dbPool = require('../db'); // Adjust path to go up one level to find db.js

// Controller function to get all categories
const getAllCategories = async (req, res) => {
  try {
    // Use the database pool to execute the query
    const [rows] = await dbPool.query('SELECT * FROM categories ORDER BY name');
    res.json(rows); // Send the results back as JSON
  } catch (error) {
    console.error('Error fetching categories:', error);
    // Send an error response back to the client
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
};

// Export the controller function so it can be used in routes
module.exports = {
  getAllCategories,
  // We will add more functions here later (e.g., addCategory, etc.)
};