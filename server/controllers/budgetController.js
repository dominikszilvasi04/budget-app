const dbPool = require('../db');

const getYearMonthFromRequest = (requestSource = {}) => {
    const now = new Date();
    const parsedYear = Number(requestSource.year);
    const parsedMonth = Number(requestSource.month);

    const year = Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100
        ? parsedYear
        : now.getFullYear();
    const month = Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
        ? parsedMonth
        : (now.getMonth() + 1);

    return { year, month };
};

const getCurrentBudgets = async (req, res) => {
    const { year, month } = getYearMonthFromRequest(req.query);

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

        const [rows] = await dbPool.query(query, [year, month]);

        const formattedRows = rows.map((row) => ({
            id: row.id,
            name: row.name,
            budget_amount: row.budget_amount === null ? null : parseFloat(row.budget_amount),
        }));

        res.json({
            year,
            month,
            items: formattedRows,
        });
    } catch (error) {
        console.error('Error fetching current budgets:', error);
        res.status(500).json({ message: 'Failed to fetch budget data.' });
    }
};

const setBudget = async (req, res) => {
    const { categoryId, amount } = req.body;

    if (categoryId === undefined || categoryId === null || Number.isNaN(parseInt(categoryId, 10))) {
        return res.status(400).json({ message: 'Valid Category ID is required.' });
    }

    if (amount === undefined || amount === null || typeof amount !== 'number') {
        return res.status(400).json({ message: 'Valid numeric amount is required (can be 0).' });
    }

    const parsedCategoryId = parseInt(categoryId, 10);
    const budgetAmount = parseFloat(amount.toFixed(2));
    const { year, month } = getYearMonthFromRequest(req.body);

    try {
        const upsertQuery = `
            INSERT INTO budgets (category_id, budget_year, budget_month, budget_amount)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE budget_amount = VALUES(budget_amount);
        `;

        await dbPool.query(upsertQuery, [parsedCategoryId, year, month, budgetAmount]);

        const getUpdatedBudgetQuery = `
            SELECT b.*
            FROM budgets b
            WHERE b.category_id = ? AND b.budget_year = ? AND b.budget_month = ?;
        `;
        const [updatedBudgetRows] = await dbPool.query(getUpdatedBudgetQuery, [parsedCategoryId, year, month]);

        res.status(200).json({
            message: 'Budget set successfully!',
            period: { year, month },
            budget: updatedBudgetRows[0]
                ? {
                    ...updatedBudgetRows[0],
                    budget_amount: parseFloat(updatedBudgetRows[0].budget_amount),
                }
                : null,
        });
    } catch (error) {
        console.error('Error setting budget:', error);

        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return res.status(404).json({ message: `Category with ID ${parsedCategoryId} not found.` });
        }
        res.status(500).json({ message: 'Failed to set budget due to server error.' });
    }
};

const rolloverBudgets = async (req, res) => {
    const { fromYear, fromMonth, toYear, toMonth } = req.body;

    const parsedFromYear = Number(fromYear);
    const parsedFromMonth = Number(fromMonth);
    const parsedToYear = Number(toYear);
    const parsedToMonth = Number(toMonth);

    if (
        !Number.isInteger(parsedFromYear)
        || !Number.isInteger(parsedFromMonth)
        || !Number.isInteger(parsedToYear)
        || !Number.isInteger(parsedToMonth)
        || parsedFromMonth < 1
        || parsedFromMonth > 12
        || parsedToMonth < 1
        || parsedToMonth > 12
    ) {
        return res.status(400).json({ message: 'Valid from/to year and month values are required.' });
    }

    try {
        const [insertResult] = await dbPool.query(
            `
            INSERT INTO budgets (category_id, budget_year, budget_month, budget_amount)
            SELECT b.category_id, ?, ?, b.budget_amount
            FROM budgets b
            LEFT JOIN categories c ON c.id = b.category_id
            WHERE b.budget_year = ?
              AND b.budget_month = ?
              AND c.type = 'expense'
            ON DUPLICATE KEY UPDATE budget_amount = VALUES(budget_amount)
            `,
            [parsedToYear, parsedToMonth, parsedFromYear, parsedFromMonth]
        );

        res.status(200).json({
            message: 'Budget rollover completed successfully.',
            copiedRowCount: insertResult.affectedRows,
            fromPeriod: { year: parsedFromYear, month: parsedFromMonth },
            toPeriod: { year: parsedToYear, month: parsedToMonth },
        });
    } catch (error) {
        console.error('Error rolling over budgets:', error);
        res.status(500).json({ message: 'Failed to roll over budgets.' });
    }
};

module.exports = {
    getCurrentBudgets,
    setBudget,
    rolloverBudgets,
};