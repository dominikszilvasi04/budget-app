const dbPool = require('../db');

const getAllGoals = async (req, res) => {
    try {
        const query = `
            SELECT
                id, name, target_amount, current_amount, target_date, notes, created_at
            FROM goals
            ORDER BY created_at DESC;
        `;
        const [goals] = await dbPool.query(query);

        const formattedGoals = goals.map((goal) => ({
            ...goal,
            target_amount: parseFloat(goal.target_amount),
            current_amount: parseFloat(goal.current_amount),
            target_date: goal.target_date ? new Date(goal.target_date).toISOString().split('T')[0] : null,
        }));

        res.json(formattedGoals);
    } catch (error) {
        console.error("Error fetching goals:", error);
        res.status(500).json({ message: "Failed to fetch goals." });
    }
};

const addGoal = async (req, res) => {
    const { name, target_amount, target_date = null, notes = null } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) { return res.status(400).json({ message: 'Goal name is required.' }); }
    if (name.length > 150) { return res.status(400).json({ message: 'Goal name max 150 chars.' }); }

    const parsedTargetAmount = parseFloat(target_amount);
    if (isNaN(parsedTargetAmount) || parsedTargetAmount <= 0) { return res.status(400).json({ message: 'Valid positive target amount is required.' }); }

    let validTargetDate = null;
    if (target_date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
             return res.status(400).json({ message: 'Invalid target date format. Use YYYY-MM-DD.' });
        }
        validTargetDate = target_date;
    }

    const trimmedName = name.trim();
    const finalTargetAmount = parseFloat(parsedTargetAmount.toFixed(2));

    try {
        const insertGoalQuery = `
            INSERT INTO goals (name, target_amount, current_amount, target_date, notes)
            VALUES (?, ?, ?, ?, ?);
        `;
        const [insertResult] = await dbPool.query(insertGoalQuery, [trimmedName, finalTargetAmount, 0.00, validTargetDate, notes]);

        const insertedId = insertResult.insertId;
        const [newGoalRows] = await dbPool.query('SELECT id, name, target_amount, current_amount, target_date, notes, created_at FROM goals WHERE id = ?', [insertedId]);
        if (newGoalRows.length === 0) { throw new Error('Failed to retrieve newly added goal.'); }

         const formattedGoal = {
            ...newGoalRows[0],
            target_amount: parseFloat(newGoalRows[0].target_amount),
            current_amount: parseFloat(newGoalRows[0].current_amount),
            target_date: newGoalRows[0].target_date ? new Date(newGoalRows[0].target_date).toISOString().split('T')[0] : null,
         };

        res.status(201).json({ message: 'Goal added successfully!', newGoal: formattedGoal });

    } catch (error) {
        console.error("Error adding goal:", error);
        res.status(500).json({ message: 'Failed to add goal.' });
    }
};

const addContribution = async (req, res) => {
    const { goalId } = req.params;
    const { amount, notes = null } = req.body;

    const contributionAmount = parseFloat(amount);
    if (isNaN(contributionAmount) || contributionAmount <= 0) {
        return res.status(400).json({ message: 'Valid positive contribution amount is required.' });
    }
    if (isNaN(parseInt(goalId, 10))) {
         return res.status(400).json({ message: 'Invalid goal ID.' });
    }

    const parsedGoalId = parseInt(goalId, 10);
    const contributionDate = new Date().toISOString().split('T')[0];

    let connection;

    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        const insertContributionQuery = `
            INSERT INTO goal_contributions (goal_id, amount, contribution_date, notes)
            VALUES (?, ?, ?, ?);
        `;
        await connection.query(insertContributionQuery, [parsedGoalId, contributionAmount, contributionDate, notes]);

        const updateGoalQuery = `
            UPDATE goals
            SET current_amount = current_amount + ?
            WHERE id = ?;
        `;
        const [updateGoalResult] = await connection.query(updateGoalQuery, [contributionAmount, parsedGoalId]);

        if (updateGoalResult.affectedRows === 0) {
             await connection.rollback();
             return res.status(404).json({ message: `Goal with ID ${parsedGoalId} not found.` });
        }

        await connection.commit();

        const [updatedGoalRows] = await connection.query('SELECT id, name, target_amount, current_amount, target_date, notes, created_at FROM goals WHERE id = ?', [parsedGoalId]);

         const formattedGoal = updatedGoalRows[0] ? {
            ...updatedGoalRows[0],
            target_amount: parseFloat(updatedGoalRows[0].target_amount),
            current_amount: parseFloat(updatedGoalRows[0].current_amount),
            target_date: updatedGoalRows[0].target_date ? new Date(updatedGoalRows[0].target_date).toISOString().split('T')[0] : null,
         } : null;

        res.status(201).json({ message: 'Contribution added successfully!', updatedGoal: formattedGoal });

    } catch (error) {
        console.error("Error adding contribution:", error);
        if (connection) {
            await connection.rollback();
        }
        res.status(500).json({ message: 'Failed to add contribution due to server error.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

const updateGoal = async (req, res) => {
    const { id } = req.params;
    const { name, target_amount, target_date, notes } = req.body;

    if (isNaN(parseInt(id, 10))) { return res.status(400).json({ message: 'Invalid goal ID.' }); }
    const goalId = parseInt(id, 10);

    const fieldsToUpdate = {};
    const values = [];
    let setClause = '';

    if (name !== undefined) {
        const trimmedName = name.trim();
        if (!trimmedName) return res.status(400).json({ message: 'Goal name cannot be empty if provided.' });
        if (trimmedName.length > 150) return res.status(400).json({ message: 'Goal name max 150 chars.' });
        fieldsToUpdate.name = trimmedName; values.push(trimmedName); setClause += 'name = ?';
    }
    if (target_amount !== undefined) {
         const parsedTargetAmount = parseFloat(target_amount);
         if (isNaN(parsedTargetAmount) || parsedTargetAmount <= 0) { return res.status(400).json({ message: 'Valid positive target amount required.' }); }
         const finalTargetAmount = parseFloat(parsedTargetAmount.toFixed(2));
         fieldsToUpdate.target_amount = finalTargetAmount; values.push(finalTargetAmount); setClause += (setClause ? ', ' : '') + 'target_amount = ?';
    }

    let validTargetDate = undefined;
    if (target_date !== undefined) {
         if (target_date === null || target_date === '') {
             validTargetDate = null;
         } else if (/^\d{4}-\d{2}-\d{2}$/.test(target_date)) {
             validTargetDate = target_date;
         } else {
              return res.status(400).json({ message: 'Invalid target date format. Use YYYY-MM-DD or leave empty.' });
         }
         fieldsToUpdate.target_date = validTargetDate; values.push(validTargetDate); setClause += (setClause ? ', ' : '') + 'target_date = ?';
    }

    if (notes !== undefined) {
        fieldsToUpdate.notes = notes === null || notes.trim() === '' ? null : notes.trim();
        values.push(fieldsToUpdate.notes);
        setClause += (setClause ? ', ' : '') + 'notes = ?';
    }

    if (values.length === 0) { return res.status(400).json({ message: 'No update data provided.' }); }
    values.push(goalId);

    try {
        const [checkRows] = await dbPool.query('SELECT id FROM goals WHERE id = ?', [goalId]);
        if (checkRows.length === 0) { return res.status(404).json({ message: 'Goal not found.' }); }

        const updateSql = `UPDATE goals SET ${setClause} WHERE id = ?`;
        await dbPool.query(updateSql, values);

        const [updatedGoalRows] = await dbPool.query('SELECT id, name, target_amount, current_amount, target_date, notes, created_at FROM goals WHERE id = ?', [goalId]);
        if (updatedGoalRows.length === 0) { throw new Error('Failed to retrieve updated goal.'); }

         const formattedGoal = {
            ...updatedGoalRows[0],
            target_amount: parseFloat(updatedGoalRows[0].target_amount),
            current_amount: parseFloat(updatedGoalRows[0].current_amount),
            target_date: updatedGoalRows[0].target_date ? new Date(updatedGoalRows[0].target_date).toISOString().split('T')[0] : null,
         };

        res.status(200).json({ message: 'Goal updated successfully!', updatedGoal: formattedGoal });

    } catch (error) {
        console.error('Error updating goal:', error);
        res.status(500).json({ message: 'Failed to update goal.' });
    }
};

const deleteGoal = async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id, 10))) { return res.status(400).json({ message: 'Invalid goal ID.' }); }
    const goalId = parseInt(id, 10);

    try {
        const deleteSql = 'DELETE FROM goals WHERE id = ?';
        const [result] = await dbPool.query(deleteSql, [goalId]);

        if (result.affectedRows === 0) { return res.status(404).json({ message: 'Goal not found.' }); }

        res.status(200).json({ message: `Goal with ID ${goalId} deleted successfully.` });
    } catch (error) {
        console.error('Error deleting goal:', error);
        res.status(500).json({ message: 'Failed to delete goal.' });
    }
};
module.exports = {
    getAllGoals,
    addGoal,
    addContribution,
    updateGoal,
    deleteGoal,
};