const dbPool = require('../db');

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

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ message: 'Category name is required and cannot be empty.' });
    }

    if (name.length > 100) {
         return res.status(400).json({ message: 'Category name cannot exceed 100 characters.' });
    }

    if (!type || (type !== 'income' && type !== 'expense')) {
         return res.status(400).json({ message: "Category type must be 'income' or 'expense'." });
    }

    const trimmedName = name.trim();

    try {
                const insertQuery = 'INSERT INTO categories (name, type) VALUES (?, ?)';
                const [insertResult] = await dbPool.query(insertQuery, [trimmedName, type]);

                const insertedId = insertResult.insertId;
        const [newCategoryRows] = await dbPool.query('SELECT * FROM categories WHERE id = ?', [insertedId]);

        if (newCategoryRows.length === 0) {
             return res.status(500).json({ message: 'Category added but failed to retrieve details.' });
        }

        res.status(201).json({
          message: 'Category added successfully!',
                    newCategory: newCategoryRows[0],
        });

    } catch (error) {
                console.error('Error adding category:', error.message, 'Code:', error.code);

        if (error.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({ message: `Category '${trimmedName}' already exists.` });
        }

        res.status(500).json({ message: 'Failed to add category due to a server error.' });
    }
};

const updateCategory = async (req, res) => {
    const { id } = req.params;
    const { name, color, type } = req.body;

    if (isNaN(parseInt(id, 10))) { return res.status(400).json({ message: 'Invalid category ID.' }); }
    const categoryId = parseInt(id, 10);

    const fieldsToUpdate = {};
    const values = [];
    let setClause = '';

    if (name !== undefined) {
        const trimmedName = name.trim();
        if (!trimmedName) return res.status(400).json({ message: 'Name cannot be empty.' });
        if (trimmedName.length > 100) return res.status(400).json({ message: 'Name max 100 chars.' });
        fieldsToUpdate.name = trimmedName; values.push(trimmedName); setClause += 'name = ?';
    }

    if (color !== undefined) {
         if (!/^#[0-9A-F]{6}$/i.test(color)) { return res.status(400).json({ message: 'Invalid color format.' }); }
         fieldsToUpdate.color = color; values.push(color); setClause += (setClause ? ', ' : '') + 'color = ?';
    }

    if (type !== undefined) {
        if (type !== 'income' && type !== 'expense') { return res.status(400).json({ message: "Type must be 'income' or 'expense'." }); }
        fieldsToUpdate.type = type; values.push(type); setClause += (setClause ? ', ' : '') + 'type = ?';
    }

    if (values.length === 0) { return res.status(400).json({ message: 'No update data provided.' }); }
    values.push(categoryId);

    try {
        const [checkRows] = await dbPool.query('SELECT id FROM categories WHERE id = ?', [categoryId]);
        if (checkRows.length === 0) { return res.status(404).json({ message: 'Category not found.' }); }

        const updateSql = `UPDATE categories SET ${setClause} WHERE id = ?`;
        await dbPool.query(updateSql, values);

        const [updatedCategoryRows] = await dbPool.query('SELECT * FROM categories WHERE id = ?', [categoryId]);
        if (updatedCategoryRows.length === 0) { throw new Error('Failed to retrieve updated category.'); }

        res.status(200).json({ message: 'Category updated successfully!', updatedCategory: updatedCategoryRows[0] });
    } catch (error) {
        console.error('Error updating category:', error);
        if (error.code === 'ER_DUP_ENTRY' && fieldsToUpdate.name) { return res.status(409).json({ message: `Another category with the name '${fieldsToUpdate.name}' already exists.` }); }
        res.status(500).json({ message: 'Failed to update category due to server error.' });
    }
};

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

module.exports = { getAllCategories, addCategory, updateCategory, deleteCategory };