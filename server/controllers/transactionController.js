const dbPool = require('../db');

const addTransaction = async (req, res) => {
    const { description, amount, transaction_date, category_id, goalIdToContribute = null } = req.body;

  if (amount === undefined || typeof amount !== 'number' || !transaction_date || !category_id) {
      return res.status(400).json({ message: 'Missing/invalid fields (amount, date, category).' });
  }

  const parsedAmount = parseFloat(amount.toFixed(2));
  const parsedCategoryId = parseInt(category_id, 10);

  const parsedGoalId = goalIdToContribute ? parseInt(goalIdToContribute, 10) : null;
  if (goalIdToContribute && isNaN(parsedGoalId)) {
       return res.status(400).json({ message: 'Invalid Goal ID provided for contribution.' });
  }

  let connection;
  try {
      connection = await dbPool.getConnection();
      await connection.beginTransaction();

      const transactionInsertQuery = `
          INSERT INTO transactions (description, amount, transaction_date, category_id)
          VALUES (?, ?, ?, ?)
      `;

      const transactionValues = [description, parsedAmount, transaction_date, parsedCategoryId];
      const [transactionResult] = await connection.query(transactionInsertQuery, transactionValues);
      const newTransactionId = transactionResult.insertId;

      let updatedGoal = null;
      if (parsedGoalId && parsedAmount > 0) {
           const contributionInsertQuery = `
               INSERT INTO goal_contributions (goal_id, amount, contribution_date, notes)
               VALUES (?, ?, ?, ?);
           `;

           const contributionNotes = `Linked transaction ID: ${newTransactionId}`;
           await connection.query(contributionInsertQuery, [parsedGoalId, parsedAmount, transaction_date, contributionNotes]);

           const goalUpdateQuery = `
               UPDATE goals
               SET current_amount = current_amount + ?
               WHERE id = ?;
           `;
           const [goalUpdateResult] = await connection.query(goalUpdateQuery, [parsedAmount, parsedGoalId]);

           if (goalUpdateResult.affectedRows === 0) {
                await connection.rollback();
                return res.status(404).json({ message: `Goal with ID ${parsedGoalId} not found. Transaction not saved.` });
           }

           const [updatedGoalRows] = await connection.query('SELECT * FROM goals WHERE id = ?', [parsedGoalId]);
            updatedGoal = updatedGoalRows[0] ? {
               ...updatedGoalRows[0],
               target_amount: parseFloat(updatedGoalRows[0].target_amount),
               current_amount: parseFloat(updatedGoalRows[0].current_amount),
               target_date: updatedGoalRows[0].target_date ? new Date(updatedGoalRows[0].target_date).toISOString().split('T')[0] : null,
            } : null;
      }

      await connection.commit();

      res.status(201).json({
          message: 'Transaction added successfully!',
          transactionId: newTransactionId,
          updatedGoal,
      });

  } catch (error) {
      console.error('Error adding transaction (with potential contribution):', error);
      if (connection) {
          await connection.rollback();
      }

       if (error.code === 'ER_NO_REFERENCED_ROW_2' && error.message.includes('transactions_ibfk_1')) {
            return res.status(404).json({ message: `Category with ID ${parsedCategoryId} not found.` });
       }

      res.status(500).json({ message: 'Failed to add transaction due to server error.' });
  } finally {
      if (connection) {
          connection.release();
      }
  }
};

const getAllTransactions = async (req, res) => {
  try {
    const query = `
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

    const [transactions] = await dbPool.query(query);

    const formattedTransactions = transactions.map((transaction) => ({
        ...transaction,
        transaction_date: new Date(transaction.transaction_date).toISOString().split('T')[0],
    }));

    res.json(formattedTransactions);

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
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        const contributionLinkText = `Linked transaction ID: ${transactionId}`;
        const findContributionQuery = 'SELECT id, goal_id, amount FROM goal_contributions WHERE notes = ?';
        const [contributionRows] = await connection.query(findContributionQuery, [contributionLinkText]);

        if (contributionRows.length > 0) {
            const contribution = contributionRows[0];
            const amountToReverse = parseFloat(contribution.amount);

            const updateGoalQuery = 'UPDATE goals SET current_amount = current_amount - ? WHERE id = ?';
            await connection.query(updateGoalQuery, [amountToReverse, contribution.goal_id]);

            const deleteContributionQuery = 'DELETE FROM goal_contributions WHERE id = ?';
            await connection.query(deleteContributionQuery, [contribution.id]);
        }

        const deleteTransactionQuery = 'DELETE FROM transactions WHERE id = ?';
        const [result] = await connection.query(deleteTransactionQuery, [transactionId]);

        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: 'Transaction not found.' });
        }

        await connection.commit();

        res.status(200).json({ message: `Transaction with ID ${transactionId} deleted successfully.` });

    } catch (error) {
        console.error('Error deleting transaction:', error);
        if (connection) {
            await connection.rollback();
        }
        res.status(500).json({ message: 'Failed to delete transaction due to server error.' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};

module.exports = {
  addTransaction,
  getAllTransactions,
  deleteTransaction,
};