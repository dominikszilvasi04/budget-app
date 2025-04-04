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

// --- NEW Function: Add Contribution to a Goal ---
const addContribution = async (req, res) => {
    const { goalId } = req.params; // Get goal ID from URL parameter
    const { amount, notes = null } = req.body; // Get amount and optional notes from body

    // --- Validation ---
    const contributionAmount = parseFloat(amount); // Use parseFloat for amount validation
    if (isNaN(contributionAmount) || contributionAmount <= 0) {
        return res.status(400).json({ message: 'Valid positive contribution amount is required.' });
    }
    if (isNaN(parseInt(goalId, 10))) {
         return res.status(400).json({ message: 'Invalid goal ID.' });
    }
    const parsedGoalId = parseInt(goalId, 10);
    const contributionDate = new Date().toISOString().split('T')[0]; // Use current date on server

    let connection; // Declare connection outside try for use in finally
    try {
        // --- Start Database Transaction ---
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        console.log("DB Transaction Started for contribution");

        // 1. Insert the contribution record
        const insertSql = `
            INSERT INTO goal_contributions (goal_id, amount, contribution_date, notes)
            VALUES (?, ?, ?, ?);
        `;
        const [insertResult] = await connection.query(insertSql, [parsedGoalId, contributionAmount, contributionDate, notes]);
        console.log("Contribution inserted, ID:", insertResult.insertId);

        // 2. Update the goal's current_amount
        const updateSql = `
            UPDATE goals
            SET current_amount = current_amount + ?
            WHERE id = ?;
        `;
        const [updateResult] = await connection.query(updateSql, [contributionAmount, parsedGoalId]);
        console.log("Goal current_amount updated, affected rows:", updateResult.affectedRows);

        // Check if the goal update actually happened (goal might not exist)
        if (updateResult.affectedRows === 0) {
             // If goal wasn't found to update, rollback transaction and send error
             await connection.rollback();
             console.log("Goal not found during update, rolling back transaction.");
             return res.status(404).json({ message: `Goal with ID ${parsedGoalId} not found.` });
        }

        // --- Commit Transaction ---
        await connection.commit();
        console.log("DB Transaction Committed");

        // Optionally fetch the updated goal data to return
        const [updatedGoalRows] = await connection.query('SELECT id, name, target_amount, current_amount, target_date, notes, created_at FROM goals WHERE id = ?', [parsedGoalId]);

         // Format before sending back
         const formattedGoal = updatedGoalRows[0] ? {
            ...updatedGoalRows[0],
            target_amount: parseFloat(updatedGoalRows[0].target_amount),
            current_amount: parseFloat(updatedGoalRows[0].current_amount),
            target_date: updatedGoalRows[0].target_date ? new Date(updatedGoalRows[0].target_date).toISOString().split('T')[0] : null
         } : null;


        res.status(201).json({ message: 'Contribution added successfully!', updatedGoal: formattedGoal }); // Send back updated goal

    } catch (error) {
        console.error("Error adding contribution:", error);
        // If an error occurred, rollback the transaction
        if (connection) {
            console.log("Error occurred, rolling back transaction.");
            await connection.rollback();
        }
        // Handle specific errors like foreign key violation if needed, though update check handles missing goal
        res.status(500).json({ message: 'Failed to add contribution due to server error.' });
    } finally {
        // Always release the connection back to the pool
        if (connection) {
            console.log("Releasing DB connection.");
            connection.release();
        }
    }

}
    module.exports = {
        getAllGoals,
        addGoal,
        addContribution,
        // Add updateGoal, deleteGoal exports here later when implemented
    }; // <<< Make sure this closing brace is present