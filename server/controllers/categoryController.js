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
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: 'Category name is required and cannot be empty.' });
    }
    if (name.length > 100) {
        return res.status(400).json({ message: 'Category name cannot exceed 100 characters.' });
    }
    const trimmedName = name.trim();
    try {
        const sql = 'INSERT INTO categories (name) VALUES (?)';
        const [result] = await dbPool.query(sql, [trimmedName]);
        const insertedId = result.insertId;
        const [newCategoryRows] = await dbPool.query('SELECT * FROM categories WHERE id = ?', [insertedId]);
        if (newCategoryRows.length === 0) { throw new Error('Failed to retrieve newly added category.'); }
        res.status(201).json({ message: 'Category added successfully!', newCategory: newCategoryRows[0] });
    } catch (error) {
        console.error('Error adding category:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: `Category '${trimmedName}' already exists.` });
        }
        res.status(500).json({ message: 'Failed to add category due to a server error.' });
    }
};

// --- MODIFIED Function: Update Category (Name and/or Color) ---
const updateCategory = async (req, res) => {
    const { id } = req.params;
    // Get BOTH name and color from request body
    const { name, color } = req.body;

    // --- Validation ---
    if (isNaN(parseInt(id, 10))) { return res.status(400).json({ message: 'Invalid category ID.' }); }

    // Build fields to update dynamically
    const fieldsToUpdate = {};
    const values = [];
    let setClause = '';

    // Validate and add name if provided and different
    if (name !== undefined) {
        const trimmedName = name.trim();
        if (!trimmedName) return res.status(400).json({ message: 'Category name cannot be empty if provided.' });
        if (trimmedName.length > 100) return res.status(400).json({ message: 'Category name cannot exceed 100 characters.' });
        fieldsToUpdate.name = trimmedName;
        values.push(trimmedName);
        setClause += 'name = ?';
    }

    // Validate and add color if provided
    if (color !== undefined) {
         // Basic hex color validation (starts with #, 7 chars long, valid hex chars)
         if (!/^#[0-9A-F]{6}$/i.test(color)) {
              return res.status(400).json({ message: 'Invalid color format. Use hex color code (e.g., #RRGGBB).' });
         }
         fieldsToUpdate.color = color;
         values.push(color);
         setClause += (setClause ? ', ' : '') + 'color = ?'; // Add comma if name was also updated
    }

    // Check if anything needs updating
    if (values.length === 0) {
         return res.status(400).json({ message: 'No update data provided (name or color).' });
    }

    const categoryId = parseInt(id, 10);
    values.push(categoryId); // Add ID for the WHERE clause

    try {
        // Check existence
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
module.exports = {
  getAllCategories,
  addCategory,
  updateCategory, // <-- Export new
  deleteCategory, // <-- Export new
};