// client/src/pages/HistoryPage.js
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
// Import relevant CSS or rely on App.css
// import './HistoryPage.css';

// --- Helper function (or import) ---
const formatCurrency = (num) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

function HistoryPage() {
  // --- State for this page ---
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [errorTransactions, setErrorTransactions] = useState(null);
  const [categories, setCategories] = useState([]); // Also need categories to list all headers
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [errorCategories, setErrorCategories] = useState(null);
  // State for delete status messages (optional, but good UX)
  const [deleteError, setDeleteError] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(null);

  // --- Fetch Categories Effect ---
  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      setErrorCategories(null);
      try {
        const response = await axios.get('http://localhost:5001/api/categories');
        setCategories(response.data);
      } catch (err) {
        console.error("Error fetching categories:", err);
        setErrorCategories('Failed to load categories.');
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

  // --- Fetch Transactions Effect ---
   // Separate flag/counter for triggering refetch after delete
  const [refetchTrigger, setRefetchTrigger] = useState(0);

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
  }, [refetchTrigger]); // Re-fetch when refetchTrigger changes


  // --- Transaction Deletion Handler (Copied/Adapted) ---
   const handleDeleteTransaction = async (id) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) {
      return;
    }
    setDeleteError(null); // Clear previous errors/success
    setDeleteSuccess(null);
    try {
      const response = await axios.delete(`http://localhost:5001/api/transactions/${id}`);
      setDeleteSuccess(response.data.message || 'Transaction deleted.');
      // Instead of filtering state directly, trigger a refetch
      setRefetchTrigger(prev => prev + 1); // Increment trigger to cause useEffect to run
      setTimeout(() => setDeleteSuccess(null), 3000);
    } catch (err) {
      console.error('Error deleting transaction:', err);
      let errorMessage = 'Failed to delete transaction.';
      if (err.response && err.response.data && err.response.data.message) {
        errorMessage = err.response.data.message;
      }
      setDeleteError(errorMessage);
    }
  };

  // --- Grouping Transactions Logic (Copied/Adapted) ---
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

  // --- Render Logic ---
  if (loadingCategories || loadingTransactions) {
    return <div>Loading history data...</div>;
  }
  // Prioritize category error if it prevents rendering headers
  if (errorCategories) {
    return <div style={{ color: 'red' }}>Error loading categories: {errorCategories}</div>;
  }
   // Show transaction loading error if categories loaded fine
   if (errorTransactions) {
       return <div style={{ color: 'red' }}>Error loading transactions: {errorTransactions}</div>;
   }


  return (
    <div className="history-list-section"> {/* Use a specific class */}
      <h2>Transaction History</h2>

      {/* Display Delete Status Messages */}
      {deleteError && <p style={{ color: 'red' }}>Error: {deleteError}</p>}
      {deleteSuccess && <p style={{ color: 'green' }}>{deleteSuccess}</p>}

      {categories.length === 0 && transactions.length === 0 ? (
        <p>No categories or transactions found.</p>
      ) : (
         <>
            {/* Iterate over CATEGORIES to ensure all are listed */}
            {categories.map(category => {
                const transactionsInCategory = groupedTransactions[category.name] || [];
                return (
                    <div key={category.id} className="history-category-group">
                        <h3>{category.name}</h3>
                        {transactionsInCategory.length > 0 ? (
                            <ul>
                                {transactionsInCategory.map(t => (
                                    <li key={t.id}>
                                        <span>{t.transaction_date}</span> - {' '}
                                        <span>{t.description || <i>(No description)</i>}</span>:{' '}
                                        <strong>{formatCurrency(t.amount)}</strong>
                                        <button onClick={() => handleDeleteTransaction(t.id)} className="delete-button-history">X</button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="no-transactions-msg">No transactions in this category.</p>
                        )}
                    </div>
                );
            })}

            {/* Handle Uncategorized separately */}
            {groupedTransactions['Uncategorized'] && groupedTransactions['Uncategorized'].length > 0 && (
                <div key="uncategorized" className="history-category-group">
                    <h3>Uncategorized</h3>
                    <ul>
                        {groupedTransactions['Uncategorized'].map(t => (
                            <li key={t.id}>
                                <span>{t.transaction_date}</span> - {' '}
                                <span>{t.description || <i>(No description)</i>}</span>:{' '}
                                <strong>{formatCurrency(t.amount)}</strong>
                                <button onClick={() => handleDeleteTransaction(t.id)} className="delete-button-history">X</button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </>
      )}
    </div>
  );
}

export default HistoryPage;