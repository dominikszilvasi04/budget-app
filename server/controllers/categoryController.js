// server/controllers/categoryController.js
const dbPool = require('../db');

// Keep existing getAllCategories
const getAllCategories = async (req, res) => {
  try {
    const [rows] = await dbPool.query('SELECT * FROM categories ORDER BY name');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
};

// --- NEW Function: Add Category ---
const addCategory = async (req, res) => {
  const { name } = req.body; // Get name from request body

  // --- Validation ---
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ message: 'Category name is required and cannot be empty.' });
  }
  if (name.length > 100) { // Match VARCHAR(100) limit
     return res.status(400).json({ message: 'Category name cannot exceed 100 characters.' });
  }

  const trimmedName = name.trim(); // Use trimmed name

  try {
    const sql = 'INSERT INTO categories (name) VALUES (?)';
    const [result] = await dbPool.query(sql, [trimmedName]);

    // Get the newly inserted category (including its ID)
    const insertedId = result.insertId;
    const [newCategoryRows] = await dbPool.query('SELECT * FROM categories WHERE id = ?', [insertedId]);

    if (newCategoryRows.length === 0) {
         // This shouldn't happen if insert succeeded, but check just in case
         throw new Error('Failed to retrieve newly added category.');
    }

    // Send back the newly created category object
    res.status(201).json({
      message: 'Category added successfully!',
      newCategory: newCategoryRows[0] // Send the full new category object back
    });

  } catch (error) {
    console.error('Error adding category:', error);
    // Handle specific errors like duplicate entry
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: `Category '${trimmedName}' already exists.` }); // 409 Conflict
    }
    // Handle other potential errors
    res.status(500).json({ message: 'Failed to add category due to a server error.' });
  }
};

// Export both functions
module.exports = {
  getAllCategories,
  addCategory, // <-- Export new function
};