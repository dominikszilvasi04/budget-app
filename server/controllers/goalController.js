// server/controllers/goalController.js
const dbPool = require('../db');

// GET all goals
const getAllGoals = async (req, res) => {
    // Later: Add filtering by user_id when auth is implemented
    try {
        // Select relevant goal fields, order by creation date or name
        const sql = `
            SELECT
                id, name, target_amount, current_amount, target_date, notes, created_at
            FROM goals
            ORDER BY created_at DESC;
        `;
        const [goals] = await dbPool.query(sql);

        // Format numbers/dates if necessary before sending
        const formattedGoals = goals.map(goal => ({
            ...goal,
            target_amount: parseFloat(goal.target_amount),
            current_amount: parseFloat(goal.current_amount),
            // Format date to YYYY-MM-DD or keep as is depending on preference
            target_date: goal.target_date ? new Date(goal.target_date).toISOString().split('T')[0] : null
        }));

        res.json(formattedGoals);
    } catch (error) {
        console.error("Error fetching goals:", error);
        res.status(500).json({ message: "Failed to fetch goals." });
    }
};

// POST a new goal
const addGoal = async (req, res) => {
    const { name, target_amount, target_date = null, notes = null } = req.body;
    // Later: add user_id

    // --- Validation ---
    if (!name || typeof name !== 'string' || name.trim().length === 0) { return res.status(400).json({ message: 'Goal name is required.' }); }
    if (name.length > 150) { return res.status(400).json({ message: 'Goal name max 150 chars.' }); }
    const parsedTargetAmount = parseFloat(target_amount);
    if (isNaN(parsedTargetAmount) || parsedTargetAmount <= 0) { return res.status(400).json({ message: 'Valid positive target amount is required.' }); }
    // Optional: Validate target_date format if provided
    let validTargetDate = null;
    if (target_date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
             return res.status(400).json({ message: 'Invalid target date format. Use YYYY-MM-DD.' });
        }
        validTargetDate = target_date; // Store validated date
    }

    const trimmedName = name.trim();
    const finalTargetAmount = parseFloat(parsedTargetAmount.toFixed(2));

    try {
        const sql = `
            INSERT INTO goals (name, target_amount, current_amount, target_date, notes)
            VALUES (?, ?, ?, ?, ?);
        `;
        // current_amount starts at 0
        const [result] = await dbPool.query(sql, [trimmedName, finalTargetAmount, 0.00, validTargetDate, notes]);

        const insertedId = result.insertId;
        // Fetch the newly created goal
        const [newGoalRows] = await dbPool.query('SELECT id, name, target_amount, current_amount, target_date, notes, created_at FROM goals WHERE id = ?', [insertedId]);
        if (newGoalRows.length === 0) { throw new Error('Failed to retrieve newly added goal.'); }

        // Format before sending back
         const formattedGoal = {
            ...newGoalRows[0],
            target_amount: parseFloat(newGoalRows[0].target_amount),
            current_amount: parseFloat(newGoalRows[0].current_amount),
            target_date: newGoalRows[0].target_date ? new Date(newGoalRows[0].target_date).toISOString().split('T')[0] : null
         };

        res.status(201).json({ message: 'Goal added successfully!', newGoal: formattedGoal });

    } catch (error) {
        console.error("Error adding goal:", error);
        // Handle potential duplicate goal name if UNIQUE KEY is added later
        // if (error.code === 'ER_DUP_ENTRY') { return res.status(409).json({ message: 'Goal name already exists.' }); }
        res.status(500).json({ message: 'Failed to add goal.' });
    }
};

module.exports = {
    getAllGoals,
    addGoal,
    // Add updateGoal, deleteGoal, addContribution later
};