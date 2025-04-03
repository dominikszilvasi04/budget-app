// server/controllers/budgetController.js
const dbPool = require('../db');

// GET current budget settings (categories + their budget for current month/year)
const getCurrentBudgets = async (req, res) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // JS months are 0-11, SQL needs 1-12

    try {
        // Select all categories and LEFT JOIN their budget for the current month/year
        const sql = `
        SELECT
            c.id,
            c.name,
            b.budget_amount
        FROM
            categories c
        LEFT JOIN budgets b
            ON c.id = b.category_id
            AND b.budget_year = ?
            AND b.budget_month = ?
        ORDER BY
            c.name;
        `;

        const [results] = await dbPool.query(sql, [currentYear, currentMonth]);

        // Format results slightly for frontend (ensure budget_amount is number or null)
        const formattedResults = results.map(row => ({
            id: row.id,
            name: row.name,
            // If budget_amount is null from LEFT JOIN, return null, otherwise parse it
            budget_amount: row.budget_amount === null ? null : parseFloat(row.budget_amount)
        }));

        res.json(formattedResults);

    } catch (error) {
        console.error('Error fetching current budgets:', error);
        res.status(500).json({ message: 'Failed to fetch budget data.' });
    }
};

// PUT/POST Set/Update budget for a category for the current month/year
const setBudget = async (req, res) => {
    const { categoryId, amount } = req.body;

    // Basic Validation
    if (categoryId === undefined || categoryId === null || isNaN(parseInt(categoryId, 10))) {
        return res.status(400).json({ message: 'Valid Category ID is required.' });
    }
    // Allow amount to be 0, but must be a number
    if (amount === undefined || amount === null || typeof amount !== 'number') {
         return res.status(400).json({ message: 'Valid numeric Amount is required (can be 0).' });
    }
    // Add precision checks if needed (e.g., amount >= 0)

    const parsedCategoryId = parseInt(categoryId, 10);
    const budgetAmount = parseFloat(amount.toFixed(2)); // Ensure 2 decimal places

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    try {
        // Use INSERT ... ON DUPLICATE KEY UPDATE to handle both new and existing budgets
        const sql = `
            INSERT INTO budgets (category_id, budget_year, budget_month, budget_amount)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE budget_amount = VALUES(budget_amount);
        `;

        const [result] = await dbPool.query(sql, [parsedCategoryId, currentYear, currentMonth, budgetAmount]);

        // Check result if needed (affectedRows will be 1 for INSERT, 1 or 2 for UPDATE, 0 if no change)

        // Fetch the updated/inserted budget record to send back
         const checkSql = `
            SELECT b.*
            FROM budgets b
            WHERE b.category_id = ? AND b.budget_year = ? AND b.budget_month = ?;
         `;
        const [updatedBudgetRows] = await dbPool.query(checkSql, [parsedCategoryId, currentYear, currentMonth]);


        res.status(200).json({
             message: 'Budget set successfully!',
             // Send back formatted data
             budget: updatedBudgetRows[0] ? {
                 ...updatedBudgetRows[0],
                 budget_amount: parseFloat(updatedBudgetRows[0].budget_amount)
             } : null
        });

    } catch (error) {
         console.error('Error setting budget:', error);
          // Check if it's a foreign key error (category_id doesn't exist)
         if (error.code === 'ER_NO_REFERENCED_ROW_2') {
              return res.status(404).json({ message: `Category with ID ${parsedCategoryId} not found.` });
         }
         res.status(500).json({ message: 'Failed to set budget due to server error.' });
    }
};


module.exports = {
    getCurrentBudgets,
    setBudget,
};