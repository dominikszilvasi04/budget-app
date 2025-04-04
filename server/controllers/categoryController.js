// server/controllers/categoryController.js
const dbPool = require('../db');

// Keep existing getAllCategories and addCategory
const getAllCategories = async (req, res) => {
    try {
        const [rows] = await dbPool.query('SELECT * FROM categories ORDER BY name');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Failed to fetch categories' });
    }
};

const addCategory = async (req, res) => {
    const { name, type } = req.body;

    // --- Validation ---
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        console.log("Backend validation failed: Name required"); // Add log
        return res.status(400).json({ message: 'Category name is required and cannot be empty.' });
    }
    if (name.length > 100) {
        console.log("Backend validation failed: Name too long"); // Add log
         return res.status(400).json({ message: 'Category name cannot exceed 100 characters.' });
    }
    if (!type || (type !== 'income' && type !== 'expense')) {
         console.log("Backend validation failed: Invalid type"); // Add log
         return res.status(400).json({ message: "Category type must be 'income' or 'expense'." });
    }

    const trimmedName = name.trim();
    console.log(`Backend: Attempting to insert category '${trimmedName}' with type '${type}'`); // Add log

    try {
        const sql = 'INSERT INTO categories (name, type) VALUES (?, ?)';
        const [result] = await dbPool.query(sql, [trimmedName, type]);
        console.log("Backend: Insert successful, ID:", result.insertId); // Add log

        const insertedId = result.insertId;
        // Fetch the newly inserted category to return it
        const [newCategoryRows] = await dbPool.query('SELECT * FROM categories WHERE id = ?', [insertedId]);

        if (newCategoryRows.length === 0) {
             // This case IS problematic if it happens - it means insert worked but select failed
             console.error("Backend Error: Failed to retrieve newly added category after insert."); // Log error
             // SEND A RESPONSE HERE!
             return res.status(500).json({ message: 'Category added but failed to retrieve details.' });
        }

        console.log("Backend: Sending success response with new category."); // Add log
        // Send back the newly created category object
        res.status(201).json({
          message: 'Category added successfully!',
          newCategory: newCategoryRows[0] // Send the full new category object back
        });

    } catch (error) {
        console.error('Backend Error adding category:', error.message, 'Code:', error.code); // Log specific error

        // Handle specific errors like duplicate entry
        if (error.code === 'ER_DUP_ENTRY') {
          console.log("Backend: Duplicate entry detected."); // Add log
          // Ensure response is sent
          return res.status(409).json({ message: `Category '${trimmedName}' already exists.` });
        }

        // --- Ensure a response is ALWAYS sent in catch ---
        // Handle other potential database errors
        res.status(500).json({ message: 'Failed to add category due to a server error.' });
    }
};
// --- MODIFIED: Update Category (Handles Type Update) ---
const updateCategory = async (req, res) => {
    const { id } = req.params;
    // Get name, color, AND type from body
    const { name, color, type } = req.body;

    if (isNaN(parseInt(id, 10))) { return res.status(400).json({ message: 'Invalid category ID.' }); }
    const categoryId = parseInt(id, 10);

    const fieldsToUpdate = {};
    const values = [];
    let setClause = '';

    // Name validation and update clause
    if (name !== undefined) {
        const trimmedName = name.trim();
        if (!trimmedName) return res.status(400).json({ message: 'Name cannot be empty.' });
        if (trimmedName.length > 100) return res.status(400).json({ message: 'Name max 100 chars.' });
        fieldsToUpdate.name = trimmedName; values.push(trimmedName); setClause += 'name = ?';
    }
    // Color validation and update clause
    if (color !== undefined) {
         if (!/^#[0-9A-F]{6}$/i.test(color)) { return res.status(400).json({ message: 'Invalid color format.' }); }
         fieldsToUpdate.color = color; values.push(color); setClause += (setClause ? ', ' : '') + 'color = ?';
    }
    // --- NEW: Type validation and update clause ---
    if (type !== undefined) {
        if (type !== 'income' && type !== 'expense') { return res.status(400).json({ message: "Type must be 'income' or 'expense'." }); }
        fieldsToUpdate.type = type; values.push(type); setClause += (setClause ? ', ' : '') + 'type = ?';
    }
    // Check if anything needs updating
    if (values.length === 0) { return res.status(400).json({ message: 'No update data provided.' }); }
    values.push(categoryId); // Add ID for WHERE clause
    try {
        // Check existence...
        const [checkRows] = await dbPool.query('SELECT id FROM categories WHERE id = ?', [categoryId]);
        if (checkRows.length === 0) { return res.status(404).json({ message: 'Category not found.' }); }
        // Perform the update with dynamic SET clause
        const updateSql = `UPDATE categories SET ${setClause} WHERE id = ?`;
        await dbPool.query(updateSql, values);

        // Fetch updated category
        const [updatedCategoryRows] = await dbPool.query('SELECT * FROM categories WHERE id = ?', [categoryId]);
        if (updatedCategoryRows.length === 0) { throw new Error('Failed to retrieve updated category.'); }

        res.status(200).json({ message: 'Category updated successfully!', updatedCategory: updatedCategoryRows[0] });
    } catch (error) {
        console.error('Error updating category:', error);
        if (error.code === 'ER_DUP_ENTRY' && fieldsToUpdate.name) { return res.status(409).json({ message: `Another category with the name '${fieldsToUpdate.name}' already exists.` }); }
        res.status(500).json({ message: 'Failed to update category due to server error.' });
    }
};

// --- NEW Function: Delete Category ---
const deleteCategory = async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id, 10))) { return res.status(400).json({ message: 'Invalid category ID.' }); }
    const categoryId = parseInt(id, 10);

    try {
        const deleteSql = 'DELETE FROM categories WHERE id = ?';
        const [result] = await dbPool.query(deleteSql, [categoryId]);
        if (result.affectedRows === 0) { return res.status(404).json({ message: 'Category not found.' }); }
        res.status(200).json({ message: `Category with ID ${categoryId} deleted successfully.` });
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ message: 'Failed to delete category due to server error.' });
    }
};

// Export ALL functions
module.exports = { getAllCategories, addCategory, updateCategory, deleteCategory };