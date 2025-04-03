// server/controllers/transactionController.js
const dbPool = require('../db');

// --- Add Transaction Function (Keep as is) ---
const addTransaction = async (req, res) => {
  // ... (previous code remains here) ...
    const { description, amount, transaction_date, category_id } = req.body;
    if (!amount || typeof amount !== 'number' || !transaction_date || !category_id) {
        return res.status(400).json({ message: 'Missing or invalid required fields (amount, transaction_date, category_id).' });
    }
    try {
        const sql = `
        INSERT INTO transactions (description, amount, transaction_date, category_id)
        VALUES (?, ?, ?, ?)
        `;
        const values = [description, amount, transaction_date, category_id];
        const [result] = await dbPool.query(sql, values);
        res.status(201).json({
        message: 'Transaction added successfully!',
        transactionId: result.insertId
        });
    } catch (error) {
        console.error('Error adding transaction:', error);
        res.status(500).json({ message: 'Failed to add transaction due to server error.' });
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
    // Extract the ID from the route parameters
    const { id } = req.params;
  
    // Basic validation: Ensure ID is a number
    if (isNaN(parseInt(id, 10))) {
      return res.status(400).json({ message: 'Invalid transaction ID.' });
    }
  
    try {
      const transactionId = parseInt(id, 10);
  
      // Construct the SQL Query
      const sql = 'DELETE FROM transactions WHERE id = ?';
  
      // Execute the Query
      const [result] = await dbPool.query(sql, [transactionId]);
  
      // Check if any row was actually deleted
      if (result.affectedRows === 0) {
        // If no rows were affected, the transaction ID likely didn't exist
        return res.status(404).json({ message: 'Transaction not found.' });
      }
  
      // Send Success Response (200 OK or 204 No Content are suitable)
      // Sending 200 with a message is often clearer for the frontend
      res.status(200).json({ message: `Transaction with ID ${transactionId} deleted successfully.` });
      // Alternatively, for 204 No Content:
      // res.status(204).send();
  
    } catch (error) {
      console.error('Error deleting transaction:', error);
      res.status(500).json({ message: 'Failed to delete transaction due to server error.' });
    }
  };
  

// Export both controller functions
module.exports = {
  addTransaction,
  getAllTransactions,
  deleteTransaction, // <-- Export the new function
};