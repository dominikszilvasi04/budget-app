// client/src/pages/DashboardPage.js
import React, { useState, useEffect, useMemo } from 'react'; // Make sure all hooks are imported
import axios from 'axios'; // Ensure axios is imported
// Import CSS ONLY if you have styles SPECIFIC to the dashboard layout
// that aren't covered by App.css

// --- Helper functions (moved from App.js) ---
const getTodayDate = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};
const formatCurrency = (num) => {
    return new Intl.NumberFormat('en-US', { // Adjust locale as needed
      style: 'currency',
      currency: 'USD', // Adjust currency code as needed
    }).format(num);
};

function DashboardPage() {
    // --- State Variables (moved from App.js) ---
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
    const [transactions, setTransactions] = useState([]);
    const [loadingTransactions, setLoadingTransactions] = useState(true);
    const [errorTransactions, setErrorTransactions] = useState(null);
    const [expandedCategoryName, setExpandedCategoryName] = useState(null); // For accordion


    // --- Fetch Categories Effect (moved from App.js) ---
    useEffect(() => {
        const fetchCategories = async () => {
          setLoadingCategories(true);
          setErrorCategories(null);
          try {
            const response = await axios.get('http://localhost:5001/api/categories');
            setCategories(response.data);
            if (response.data.length > 0) {
              const defaultCategory = response.data.find(cat => cat.name.toLowerCase() === 'uncategorized');
              // Ensure ID is string for select value comparison
              setSelectedCategoryId(defaultCategory ? defaultCategory.id.toString() : response.data[0].id.toString());
            }
          } catch (err) {
            console.error("Error fetching categories:", err);
            setErrorCategories('Failed to load categories. Is the backend server running?');
          } finally {
            setLoadingCategories(false);
          }
        };
        fetchCategories();
    }, []); // Empty dependency array - fetch categories once on mount

    // --- Fetch Transactions Effect (moved from App.js) ---
    useEffect(() => {
        const fetchTransactions = async () => {
          setLoadingTransactions(true);
          setErrorTransactions(null);
          try {
            const response = await axios.get('http://localhost:5001/api/transactions');
            setTransactions(response.data);
          } catch (err) {
            console.error("Error fetching transactions:", err);
            setErrorTransactions('Failed to load transactions.');
          } finally {
            setLoadingTransactions(false);
          }
        };
        fetchTransactions();
    }, [submitSuccess]); // Re-fetch transactions when a submission succeeds


    // --- Form Submission Handler (moved from App.js) ---
    const handleTransactionSubmit = async (event) => {
        event.preventDefault();
        if (!amount || isNaN(parseFloat(amount)) || !selectedCategoryId || !transactionDate) {
            setSubmitError('Please fill in amount, date, and select a category.');
            setSubmitSuccess(null);
            return;
        }
        const transactionData = {
          description: description || null,
          amount: parseFloat(amount),
          transaction_date: transactionDate,
          category_id: parseInt(selectedCategoryId, 10),
        };
        setIsSubmitting(true);
        setSubmitError(null);
        setSubmitSuccess(null);
        try {
          const response = await axios.post('http://localhost:5001/api/transactions', transactionData);
          console.log('Transaction added:', response.data);
          setSubmitSuccess(`Transaction added successfully! (ID: ${response.data.transactionId})`);
          setDescription('');
          setAmount('');
          setTransactionDate(getTodayDate());
          // Maybe reset category, depends on desired UX
          // setSelectedCategoryId(categories.length > 0 ? categories[0].id.toString() : '');
          setTimeout(() => setSubmitSuccess(null), 3000);
        } catch (err) {
          console.error('Error submitting transaction:', err);
          let errorMessage = 'Failed to add transaction. Please try again.';
          if (err.response && err.response.data && err.response.data.message) {
            errorMessage = err.response.data.message;
          }
          setSubmitError(errorMessage);
        } finally {
          setIsSubmitting(false);
        }
    };

    // --- Transaction Deletion Handler (moved from App.js) ---
    const handleDeleteTransaction = async (id) => {
        if (!window.confirm('Are you sure you want to delete this transaction?')) {
          return;
        }
        // Re-use submitError/Success for delete status for simplicity here
        setSubmitError(null);
        setSubmitSuccess(null);
        try {
          const response = await axios.delete(`http://localhost:5001/api/transactions/${id}`);
          console.log('Delete response:', response.data);
          // Update the frontend state directly for immediate feedback on dashboard
          setTransactions(currentTransactions =>
            currentTransactions.filter(transaction => transaction.id !== id)
          );
          setSubmitSuccess(response.data.message || 'Transaction deleted.');
          setTimeout(() => setSubmitSuccess(null), 3000);
        } catch (err) {
          console.error('Error deleting transaction:', err);
          let errorMessage = 'Failed to delete transaction.';
          if (err.response && err.response.data && err.response.data.message) {
            errorMessage = err.response.data.message;
          }
          setSubmitError(errorMessage);
        }
    };

    // --- Category Click Handler for Accordion (moved from App.js) ---
    const handleCategoryClick = (categoryName) => {
        setExpandedCategoryName(prevExpanded =>
            prevExpanded === categoryName ? null : categoryName
        );
    };

    // --- Grouping Transactions Logic (useMemo) (moved from App.js) ---
    const groupedTransactions = useMemo(() => {
         const groups = {};
         transactions.forEach(t => {
            const categoryName = t.category_name || 'Uncategorized';
            if (!groups[categoryName]) {
                groups[categoryName] = [];
            }
            groups[categoryName].push(t);
         });
         return groups;
    }, [transactions]);


    // --- Render Logic for Dashboard Page ---
    // Handle combined initial loading state
    if (loadingCategories) {
        // Could add a spinner component later
        return <div>Loading dashboard data...</div>;
    }

    // Handle error preventing category load (critical for form)
    if (errorCategories && categories.length === 0) {
        return <div style={{ color: 'red', padding: '20px' }}>Error loading categories: {errorCategories}. Cannot display dashboard.</div>;
    }

    return (
        // Using fragment as the top-level layout div is now handled by App.js
        <>
          <div className="main-layout">
              {/* --- Transaction Form Section --- */}
              <section className="form-section">
                  <h2>Add New Transaction</h2>
                  {/* Display Submission Status Messages */}
                  {submitError && <p style={{ color: 'red' }}>Error: {submitError}</p>}
                  {submitSuccess && <p style={{ color: 'green' }}>{submitSuccess}</p>}
                  {/* The Form */}
                  <form onSubmit={handleTransactionSubmit}>
                      {/* Description Input */}
                      <div>
                          <label htmlFor="description">Description:</label>
                          <input type="text" id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" disabled={isSubmitting} />
                      </div>
                      {/* Amount Input */}
                      <div>
                          <label htmlFor="amount">Amount:</label>
                          <input type="number" id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g., 25.50" step="0.01" required disabled={isSubmitting} />
                      </div>
                      {/* Date Input */}
                      <div>
                          <label htmlFor="transactionDate">Date:</label>
                          <input type="date" id="transactionDate" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} required disabled={isSubmitting} />
                      </div>
                      {/* Category Select */}
                      <div>
                          <label htmlFor="category">Category:</label>
                          <select id="category" value={selectedCategoryId} onChange={(e) => setSelectedCategoryId(e.target.value)} required disabled={isSubmitting || categories.length === 0}>
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

              {/* --- Transactions List Section (Accordion) --- */}
              <section className="transactions-section">
                  <h2>Transactions</h2>
                  {/* Loading/Error checks specifically for transactions */}
                  {loadingTransactions && <p>Loading transactions...</p>}
                  {/* Show transaction error only if categories loaded okay */}
                  {!loadingCategories && errorTransactions && <p style={{ color: 'red' }}>Error: {errorTransactions}</p>}

                  {/* Transaction Accordion Logic - Renders when transactions are not loading and categories did not fail critically */}
                  {!loadingTransactions && (!errorCategories || categories.length > 0) && (
                      categories.length === 0 && transactions.length === 0 ? (
                           <p>No categories or transactions found.</p>
                      ) : (
                          <div className="category-accordion">
                              {/* Iterate over CATEGORIES to ensure all are listed */}
                              {categories.map(category => {
                                  const transactionsInCategory = groupedTransactions[category.name] || [];
                                  return (
                                      <div key={category.id} className="category-box">
                                          <h3 onClick={() => handleCategoryClick(category.name)} className="category-header" style={{ cursor: 'pointer' }}>
                                              {category.name}
                                              <span style={{ float: 'right', transition: 'transform 0.2s', transform: expandedCategoryName === category.name ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                                          </h3>
                                          {expandedCategoryName === category.name && (
                                              transactionsInCategory.length > 0 ? (
                                                  <ul>
                                                      {transactionsInCategory.map(t => (
                                                          <li key={t.id}>
                                                              <span>{t.transaction_date}</span> - {' '}
                                                              <span>{t.description || <i>(No description)</i>}</span>:{' '}
                                                              <strong>{formatCurrency(t.amount)}</strong>
                                                              <button onClick={() => handleDeleteTransaction(t.id)} style={{ marginLeft: '10px', color: 'red', cursor: 'pointer' }} title="Delete Transaction">X</button>
                                                          </li>
                                                      ))}
                                                  </ul>
                                              ) : (
                                                  <p style={{ paddingLeft: '20px', fontStyle: 'italic' }}>No transactions in this category.</p>
                                              )
                                          )}
                                      </div>
                                  );
                              })}
                              {/* Handle Uncategorized separately */}
                              {groupedTransactions['Uncategorized'] && groupedTransactions['Uncategorized'].length > 0 && (
                                  <div key="uncategorized" className="category-box">
                                       <h3 onClick={() => handleCategoryClick('Uncategorized')} className="category-header" style={{ cursor: 'pointer' }}>
                                             Uncategorized
                                             <span style={{ float: 'right', transition: 'transform 0.2s' , transform: expandedCategoryName === 'Uncategorized' ? 'rotate(180deg)' : 'rotate(0deg)'}}>▼</span>
                                       </h3>
                                       {expandedCategoryName === 'Uncategorized' && (
                                           <ul>
                                               {groupedTransactions['Uncategorized'].map(t => (
                                                   <li key={t.id}>
                                                       <span>{t.transaction_date}</span> - {' '}
                                                       <span>{t.description || <i>(No description)</i>}</span>:{' '}
                                                       <strong>{formatCurrency(t.amount)}</strong>
                                                       <button onClick={() => handleDeleteTransaction(t.id)} style={{ marginLeft: '10px', color: 'red', cursor: 'pointer' }} title="Delete Transaction">X</button>
                                                   </li>
                                               ))}
                                           </ul>
                                       )}
                                  </div>
                              )}
                          </div> // End category-accordion
                      )
                  )}
              </section>
          </div>
        </> // End React Fragment
    );
}

export default DashboardPage;