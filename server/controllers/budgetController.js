const dbPool = require('../db');

const getCurrentBudgets = async (req, res) => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    try {
        const query = `
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

        const [rows] = await dbPool.query(query, [currentYear, currentMonth]);

        const formattedRows = rows.map((row) => ({
            id: row.id,
            name: row.name,
            budget_amount: row.budget_amount === null ? null : parseFloat(row.budget_amount),
        }));

        res.json(formattedRows);

    } catch (error) {
        console.error('Error fetching current budgets:', error);
        res.status(500).json({ message: 'Failed to fetch budget data.' });
    }
};

const setBudget = async (req, res) => {
    const { categoryId, amount } = req.body;

    if (categoryId === undefined || categoryId === null || isNaN(parseInt(categoryId, 10))) {
        return res.status(400).json({ message: 'Valid Category ID is required.' });
    }

    if (amount === undefined || amount === null || typeof amount !== 'number') {
         return res.status(400).json({ message: 'Valid numeric Amount is required (can be 0).' });
    }

    const parsedCategoryId = parseInt(categoryId, 10);
    const budgetAmount = parseFloat(amount.toFixed(2));

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    try {
        const upsertQuery = `
            INSERT INTO budgets (category_id, budget_year, budget_month, budget_amount)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE budget_amount = VALUES(budget_amount);
        `;

        await dbPool.query(upsertQuery, [parsedCategoryId, currentYear, currentMonth, budgetAmount]);

         const getUpdatedBudgetQuery = `
            SELECT b.*
            FROM budgets b
            WHERE b.category_id = ? AND b.budget_year = ? AND b.budget_month = ?;
         `;
        const [updatedBudgetRows] = await dbPool.query(getUpdatedBudgetQuery, [parsedCategoryId, currentYear, currentMonth]);


        res.status(200).json({
             message: 'Budget set successfully!',
             budget: updatedBudgetRows[0] ? {
                 ...updatedBudgetRows[0],
                 budget_amount: parseFloat(updatedBudgetRows[0].budget_amount),
             } : null,
        });

    } catch (error) {
         console.error('Error setting budget:', error);

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