// server/controllers/transactionController.js
const dbPool = require('../db');

// --- Add Transaction Function (Keep as is) ---
const addTransaction = async (req, res) => {
  // Extract potential goal ID along with other data
  const { description, amount, transaction_date, category_id, goalIdToContribute = null } = req.body; // Default goal ID to null

  // Basic Validation
  if (amount === undefined || typeof amount !== 'number' || !transaction_date || !category_id) {
      return res.status(400).json({ message: 'Missing/invalid fields (amount, date, category).' });
  }
  const parsedAmount = parseFloat(amount.toFixed(2));
  const parsedCategoryId = parseInt(category_id, 10);
  // Validate optional goal ID if provided
  const parsedGoalId = goalIdToContribute ? parseInt(goalIdToContribute, 10) : null;
  if (goalIdToContribute && isNaN(parsedGoalId)) {
       return res.status(400).json({ message: 'Invalid Goal ID provided for contribution.' });
  }
  // Decide if contribution amount should be same as transaction amount, or separate?
  // For now, assume transaction amount IS the contribution amount if goalId is provided.
  // Also, should this only apply to 'income' type transactions later? Assume yes for now.

  let connection;
  try {
      // --- Start Database Transaction ---
      // We need a transaction because we might do 2+ operations (insert tx, insert contribution, update goal)
      connection = await dbPool.getConnection();
      await connection.beginTransaction();
      console.log("DB Transaction Started for add transaction");

      // 1. Insert the main transaction record
      const transactionSql = `
          INSERT INTO transactions (description, amount, transaction_date, category_id)
          VALUES (?, ?, ?, ?)
      `;
      const transactionValues = [description, parsedAmount, transaction_date, parsedCategoryId];
      const [transactionResult] = await connection.query(transactionSql, transactionValues);
      const newTransactionId = transactionResult.insertId;
      console.log("Transaction inserted, ID:", newTransactionId);


      // --- Optional Goal Contribution Logic ---
      let updatedGoal = null; // Variable to store updated goal data if contribution happens
      if (parsedGoalId && parsedAmount > 0) { // Only contribute if goal selected and amount is positive
           console.log(`Attempting to contribute ${parsedAmount} to goal ID ${parsedGoalId}`);

           // TODO (Future): Check if category type is 'income' before proceeding?
           // const [catTypeRows] = await connection.query('SELECT type FROM categories WHERE id = ?', [parsedCategoryId]);
           // if (!catTypeRows[0] || catTypeRows[0].type !== 'income') {
           //    console.log("Contribution skipped: Category is not income type.");
           // } else { ... proceed ... }


           // 2. Insert the contribution record
           const contribSql = `
               INSERT INTO goal_contributions (goal_id, amount, contribution_date, notes)
               VALUES (?, ?, ?, ?);
           `;
           // Use transaction date for contribution date? Or current date? Let's use transaction date.
           // Note for contribution could be transaction description?
           const contributionNotes = `From transaction: ${description || `ID ${newTransactionId}`}`;
           const [contribResult] = await connection.query(contribSql, [parsedGoalId, parsedAmount, transaction_date, contributionNotes]);
           console.log("Contribution inserted, ID:", contribResult.insertId);

           // 3. Update the goal's current_amount
           const updateGoalSql = `
               UPDATE goals
               SET current_amount = current_amount + ?
               WHERE id = ?;
           `;
           const [updateGoalResult] = await connection.query(updateGoalSql, [parsedAmount, parsedGoalId]);
           console.log("Goal current_amount updated for contribution, affected rows:", updateGoalResult.affectedRows);

           // Check if goal update succeeded
           if (updateGoalResult.affectedRows === 0) {
                // Goal ID likely invalid, rollback everything
                await connection.rollback();
                console.log("Goal not found during contribution update, rolling back transaction.");
                // Send specific error - transaction was NOT saved either due to rollback
                return res.status(404).json({ message: `Goal with ID ${parsedGoalId} not found. Transaction not saved.` });
           }

           // Fetch updated goal data if contribution was made
           const [updatedGoalRows] = await connection.query('SELECT * FROM goals WHERE id = ?', [parsedGoalId]);
            updatedGoal = updatedGoalRows[0] ? {
               ...updatedGoalRows[0],
               target_amount: parseFloat(updatedGoalRows[0].target_amount),
               current_amount: parseFloat(updatedGoalRows[0].current_amount),
               target_date: updatedGoalRows[0].target_date ? new Date(updatedGoalRows[0].target_date).toISOString().split('T')[0] : null
            } : null;

      } // End if (parsedGoalId && parsedAmount > 0)
      // --- End Optional Goal Contribution Logic ---


      // --- Commit Transaction ---
      await connection.commit();
      console.log("DB Transaction Committed");

      // Send success response including transaction ID and potentially updated goal
      res.status(201).json({
          message: 'Transaction added successfully!',
          transactionId: newTransactionId,
          updatedGoal: updatedGoal // Will be null if no contribution was made
      });

  } catch (error) {
      console.error('Error adding transaction (with potential contribution):', error);
      if (connection) {
          console.log("Rolling back transaction due to error.");
          await connection.rollback();
      }
       // Check for foreign key error on category_id if needed
       if (error.code === 'ER_NO_REFERENCED_ROW_2' && error.message.includes('transactions_ibfk_1')) {
            return res.status(404).json({ message: `Category with ID ${parsedCategoryId} not found.` });
       }
      res.status(500).json({ message: 'Failed to add transaction due to server error.' });
  } finally {
      if (connection) {
          console.log("Releasing DB connection.");
          connection.release();
      }
  }
};


// --- New Function: Get All Transactions ---
const getAllTransactions = async (req, res) => {
  try {
    // SQL query with LEFT JOIN to include category name
    // Order by date descending, then by creation time descending as a fallback
    const sql = `
      SELECT
        t.id,
        t.description,
        t.amount,
        t.transaction_date,
        t.category_id,
        t.created_at,
        c.name AS category_name
      FROM
        transactions t
      LEFT JOIN
        categories c ON t.category_id = c.id
      ORDER BY
        t.transaction_date DESC, t.created_at DESC;
    `;

    const [transactions] = await dbPool.query(sql);

    // Format the date for better consistency (optional, but good practice)
    const formattedTransactions = transactions.map(t => ({
        ...t,
        // Format date to YYYY-MM-DD string (database might return a Date object or different string format)
        transaction_date: new Date(t.transaction_date).toISOString().split('T')[0]
    }));


    res.json(formattedTransactions); // Send the joined data

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Failed to fetch transactions' });
  }
};

const deleteTransaction = async (req, res) => {
    const { id } = req.params;
    if (isNaN(parseInt(id, 10))) {
        return res.status(400).json({ message: 'Invalid transaction ID.' });
    }
    const transactionId = parseInt(id, 10);

    let connection;
    try {
        // --- Start DB Transaction for safe deletion ---
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        // 1. Check if this transaction resulted in a contribution
        // We can find it by looking for a note that links them.
        // NOTE: This assumes your `addTransaction` contribution note is reliable.
        const contributionNotes = `From transaction: ID ${transactionId}`;
        const findContribSql = 'SELECT id, goal_id, amount FROM goal_contributions WHERE notes = ?';
        const [contribRows] = await connection.query(findContribSql, [contributionNotes]);

        // 2. If a contribution was found, reverse it
        if (contribRows.length > 0) {
            const contribution = contribRows[0];
            const amountToReverse = parseFloat(contribution.amount);

            console.log(`Reversing contribution ${contribution.id} of ${amountToReverse} from goal ${contribution.goal_id}`);

            // 2a. Subtract the amount from the goal's current_amount
            const updateGoalSql = 'UPDATE goals SET current_amount = current_amount - ? WHERE id = ?';
            await connection.query(updateGoalSql, [amountToReverse, contribution.goal_id]);

            // 2b. Delete the contribution record itself
            const deleteContribSql = 'DELETE FROM goal_contributions WHERE id = ?';
            await connection.query(deleteContribSql, [contribution.id]);
        }

        // 3. Finally, delete the main transaction record
        const deleteTxSql = 'DELETE FROM transactions WHERE id = ?';
        const [result] = await connection.query(deleteTxSql, [transactionId]);

        if (result.affectedRows === 0) {
            // If the transaction wasn't found, nothing was done, so rollback and send 404
            await connection.rollback();
            return res.status(404).json({ message: 'Transaction not found.' });
        }

        // --- Commit all changes ---
        await connection.commit();

        res.status(200).json({ message: `Transaction with ID ${transactionId} deleted successfully.` });

    } catch (error) {
        console.error('Error deleting transaction:', error);
        if (connection) {
            await connection.rollback(); // Rollback on any error
        }
        res.status(500).json({ message: 'Failed to delete transaction due to server error.' });
    } finally {
        if (connection) {
            connection.release(); // Always release connection
        }
    }
};

// ... update module.exports to include the new deleteTransaction ...
module.exports = {
  addTransaction,
  getAllTransactions,
  deleteTransaction,
};