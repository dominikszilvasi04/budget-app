// client/src/App.js
import React, { useState, useEffect, useMemo } from 'react'; // <-- Add useMemo
import axios from 'axios';
import './App.css';

// Helper function to get today's date (keep as is)
const getTodayDate = () => {
  // ... (code from previous step)
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};


function App() {
  // --- Existing State ---
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [errorCategories, setErrorCategories] = useState(null);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(getTodayDate());
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  // --- New State for Transactions List ---
  const [transactions, setTransactions] = useState([]);           // To store fetched transactions
  const [loadingTransactions, setLoadingTransactions] = useState(true); // Loading status for transactions
  const [errorTransactions, setErrorTransactions] = useState(null);   // Error status for transactions


  // --- Fetch Categories Effect --- (Keep as is, including default category logic)
  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      setErrorCategories(null);
      try {
        const response = await axios.get('http://localhost:5001/api/categories');
        setCategories(response.data);
        if (response.data.length > 0) {
          const defaultCategory = response.data.find(cat => cat.name.toLowerCase() === 'uncategorized');
          setSelectedCategoryId(defaultCategory ? defaultCategory.id.toString() : response.data[0].id.toString()); // Ensure ID is string for select value
        }
      } catch (err) {
        console.error("Error fetching categories:", err);
        setErrorCategories('Failed to load categories. Is the backend server running?');
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

   // --- New Effect to Fetch Transactions ---
  useEffect(() => {
    const fetchTransactions = async () => {
      setLoadingTransactions(true);
      setErrorTransactions(null);
      try {
        const response = await axios.get('http://localhost:5001/api/transactions');
        setTransactions(response.data); // Update state with fetched transactions
      } catch (err) {
        console.error("Error fetching transactions:", err);
        setErrorTransactions('Failed to load transactions. Is the backend server running?');
      } finally {
        setLoadingTransactions(false);
      }
    };

    fetchTransactions(); // Fetch initially

    // Re-fetch transactions whenever a new one is successfully submitted
    // We use submitSuccess changing as a trigger. A more robust way might involve a counter.
  }, [submitSuccess]); // <-- Dependency array includes submitSuccess

  // --- Updated Form Submission Handler ---
  const handleTransactionSubmit = async (event) => { // Make the handler async
    event.preventDefault(); // Prevent default page reload

    // Basic validation
    if (!amount || isNaN(parseFloat(amount)) || !selectedCategoryId || !transactionDate) {
        setSubmitError('Please fill in amount, date, and select a category.');
        setSubmitSuccess(null); // Clear success message if validation fails
        return;
    }

    const transactionData = {
      description: description || null, // Send null if empty
      amount: parseFloat(amount),
      transaction_date: transactionDate,
      category_id: parseInt(selectedCategoryId, 10),
    };

    setIsSubmitting(true); // Indicate submission start
    setSubmitError(null);   // Clear previous errors
    setSubmitSuccess(null); // Clear previous success message

    try {
      // Make the POST request to the backend API endpoint
      const response = await axios.post('http://localhost:5001/api/transactions', transactionData);

      // --- Handle Success ---
      console.log('Transaction added:', response.data);
      setSubmitSuccess(`Transaction added successfully! (ID: ${response.data.transactionId})`);

      // Clear the form fields
      setDescription('');
      setAmount('');
      setTransactionDate(getTodayDate()); // Reset date to today
      // Optionally reset category, or leave it as is for potentially faster entry of similar items
      // setSelectedCategoryId(categories.length > 0 ? categories[0].id.toString() : '');

      // Hide success message after a few seconds
      setTimeout(() => setSubmitSuccess(null), 3000);


    } catch (err) {
      // --- Handle Error ---
      console.error('Error submitting transaction:', err);
      let errorMessage = 'Failed to add transaction. Please try again.';
      // Check if the server sent a specific error message
      if (err.response && err.response.data && err.response.data.message) {
        errorMessage = err.response.data.message;
      }
      setSubmitError(errorMessage);

    } finally {
      // --- Runs after success or error ---
      setIsSubmitting(false); // Indicate submission end
    }
  };


  // --- Grouping Transactions Logic (using useMemo for optimization) ---
  const groupedTransactions = useMemo(() => {
    const groups = {}; // Initialize an empty object for groups

    transactions.forEach(t => {
      // Use category_name, default to 'Uncategorized' if null or missing
      const categoryName = t.category_name || 'Uncategorized';

      // If the group for this category doesn't exist yet, create it as an empty array
      if (!groups[categoryName]) {
        groups[categoryName] = [];
      }

      // Add the current transaction to the appropriate group
      groups[categoryName].push(t);
    });

    // Optional: Sort categories alphabetically, maybe 'Uncategorized' last?
    // const sortedCategoryNames = Object.keys(groups).sort((a, b) => {
    //   if (a === 'Uncategorized') return 1;
    //   if (b === 'Uncategorized') return -1;
    //   return a.localeCompare(b);
    // });
    // const sortedGroups = {};
    // sortedCategoryNames.forEach(name => sortedGroups[name] = groups[name]);
    // return sortedGroups;

    return groups; // Return the grouped object

  }, [transactions]); // <-- Re-run memoization only when the transactions array changes


  // --- Helper function to format currency ---
  const formatCurrency = (num) => {
    return new Intl.NumberFormat('en-US', { // Adjust locale as needed
      style: 'currency',
      currency: 'USD', // Adjust currency code as needed
    }).format(num);
  };

  // --- Render Logic ---
  // Optional: Combine loading states if desired
  if (loadingCategories) { // Still need categories for the form
    return <div className="App">Loading initial data...</div>;
  }
  // Only show category error if it prevents form usage
  if (errorCategories && categories.length === 0) {
    return <div className="App">Error loading categories: {errorCategories}</div>;
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Budget Tracker</h1>

        {/* --- Transaction Form Section --- */}
        <section>
          <h2>Add New Transaction</h2>
          {/* Status Messages */}
          {submitError && <p style={{ color: 'red' }}>Error: {submitError}</p>}
          {submitSuccess && <p style={{ color: 'green' }}>{submitSuccess}</p>}
          {/* The Form */}
          <form onSubmit={handleTransactionSubmit}>
              {/* ... (form inputs remain the same) ... */}
              {/* Description Input */}
              <div>
                <label htmlFor="description">Description:</label>
                <input
                    type="text" id="description" value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description" disabled={isSubmitting}
                />
              </div>
              {/* Amount Input */}
              <div>
                <label htmlFor="amount">Amount:</label>
                <input
                    type="number" id="amount" value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g., 25.50" step="0.01" required disabled={isSubmitting}
                />
              </div>
              {/* Date Input */}
              <div>
                <label htmlFor="transactionDate">Date:</label>
                <input
                    type="date" id="transactionDate" value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    required disabled={isSubmitting}
                />
              </div>
              {/* Category Select */}
              <div>
                <label htmlFor="category">Category:</label>
                <select
                    id="category" value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    required disabled={isSubmitting || categories.length === 0}
                >
                  <option value="" disabled>-- Select a Category --</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id.toString()}>
                        {category.name}
                    </option>
                  ))}
                </select>
              </div>
              {/* Submit Button */}
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add Transaction'}
              </button>
          </form>
        </section>


        {/* --- Transactions List Section --- */}
        <section>
          <h2>Transactions</h2>
          {loadingTransactions && <p>Loading transactions...</p>}
          {errorTransactions && <p style={{ color: 'red' }}>Error: {errorTransactions}</p>}

          {/* Display transactions only if not loading and no errors */}
          {!loadingTransactions && !errorTransactions && (
            // Check if there are any transactions at all
            transactions.length === 0 ? (
              <p>No transactions recorded yet.</p>
            ) : (
              // Iterate over the grouped transactions object
              Object.entries(groupedTransactions).map(([categoryName, transactionsInCategory]) => (
                <div key={categoryName} className="category-group">
                  <h3>{categoryName}</h3>
                  {transactionsInCategory.length > 0 ? (
                    <ul>
                      {transactionsInCategory.map(t => (
                        <li key={t.id}>
                          <span>{t.transaction_date}</span> - {' '}
                          <span>{t.description || <i>(No description)</i>}</span>:{' '}
                          <strong>{formatCurrency(t.amount)}</strong>
                          {/* Add Edit/Delete buttons later */}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    // This case shouldn't happen with our current grouping logic, but good practice
                    <p>No transactions in this category.</p>
                  )}
                </div>
              ))
            )
          )}
        </section>

        {/* --- Display Categories List (Optional: Keep or Remove) --- */}
        {/* ... */}

      </header>
    </div>
  );
}

export default App;