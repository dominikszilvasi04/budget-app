// client/src/pages/HistoryPage.js
import React, { useState, useEffect, useMemo, useCallback } from 'react'; // Added useMemo, useCallback
import axios from 'axios';
// Import relevant CSS or rely on App.css
// import './HistoryPage.css';

// --- Helper function (or import) ---
const formatCurrency = (num) => {
    const parsedNum = typeof num === 'number' ? num : parseFloat(num);
    if (isNaN(parsedNum)) { num = 0; } else { num = parsedNum; }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

const safeParseFloat = (value) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  const cleanedValue = value.trim();
  if (cleanedValue === '') return NaN;
  const parsed = parseFloat(cleanedValue);
  return isNaN(parsed) ? NaN : parsed;
};

function HistoryPage() {
  // --- State for this page ---
  const [transactions, setTransactions] = useState([]);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [errorTransactions, setErrorTransactions] = useState(null);
  // --- NEW: State for Categories ---
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [errorCategories, setErrorCategories] = useState(null);

  const [deleteError, setDeleteError] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0); // For refetching transactions after delete

  // --- Fetch Categories Effect ---
  useEffect(() => {
    const controller = new AbortController();
    const fetchCategories = async () => {
        setLoadingCategories(true); setErrorCategories(null);
        try {
            const response = await axios.get('http://localhost:5001/api/categories', { signal: controller.signal });
            setCategories(response.data); // Store all categories
        } catch (err) {
            if (!axios.isCancel(err)) { console.error("Error fetching categories for history:", err); setErrorCategories('Failed to load category details.'); }
        } finally { if (!controller.signal.aborted) setLoadingCategories(false); }
    };
    fetchCategories();
    return () => controller.abort();
}, []); // Fetch once on mount


  // --- Fetch Transactions Effect ---
   // Separate flag/counter for triggering refetch after delete

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

  // --- Process Data for Grouping by Type (Corrected safeParseFloat usage) ---
  const groupedByType = useMemo(() => {
    if (loadingCategories || loadingTransactions || !categories || !transactions) {
        return { income: [], expense: [], uncategorized: [], incomeTotal: 0, expenseTotal: 0 }; // Include totals in default
    }

    const categoryTypeMap = categories.reduce((acc, cat) => { acc[cat.id] = cat.type; return acc; }, {});
    const incomeTransactions = [];
    const expenseTransactions = [];
    const uncategorizedTransactions = [];

    transactions.forEach(t => {
        const categoryId = t.category_id;
        const type = categoryId !== null ? categoryTypeMap[categoryId] : null;

        if (type === 'income') { incomeTransactions.push(t); }
        else if (type === 'expense') { expenseTransactions.push(t); }
        else { uncategorizedTransactions.push(t); }
    });

    // Calculate totals using the CORRECT function name
    const incomeTotal = incomeTransactions.reduce((sum, t) => sum + (safeParseFloat(t.amount) || 0), 0); // Use defined safeParseFloat
    const expenseTotal = expenseTransactions.reduce((sum, t) => sum + (safeParseFloat(t.amount) || 0), 0); // Use defined safeParseFloat

    return {
        income: incomeTransactions,
        expense: expenseTransactions,
        uncategorized: uncategorizedTransactions,
        incomeTotal: incomeTotal, // Add totals to returned object
        expenseTotal: expenseTotal
    };

}, [categories, transactions, loadingCategories, loadingTransactions]);

  // --- Render Logic ---
    // Combined loading check
    const isLoading = loadingCategories || loadingTransactions;
    if (isLoading) { return <div>Loading history data...</div>; }
    // Combined error check (can refine later)
    const displayError = errorCategories || errorTransactions;
    if (displayError) { return <div style={{ color: 'red', padding: '20px' }}>Error: {displayError}</div>; }

  // --- JSX Return Statement (Modified) ---
  return (
    <div className="history-list-section">
        <h2>Transaction History</h2>

        {/* Display Delete Status Messages */}
        {deleteError && <p className="options-error">{deleteError}</p>} {/* Reuse style */}
        {deleteSuccess && <p className="options-success">{deleteSuccess}</p>} {/* Reuse style */}

        {/* --- Income Section --- */}
        <div className="history-type-section">
            <h3>Income (+{formatCurrency(groupedByType.incomeTotal)})</h3>
            {groupedByType.income.length === 0 ? (
                <p className="no-transactions-msg">No income transactions recorded.</p>
            ) : (
                <ul>
                    {groupedByType.income.map(t => (
                        <li key={t.id}>
                            {/* Details - maybe add category name? */}
                            <span className="history-date">{t.transaction_date}</span>
                            <span className="history-category">({t.category_name || 'N/A'})</span> {/* category_name from existing transaction fetch */}
                            <span className="history-desc">{t.description || <i>(No description)</i>}</span>
                            <span className="history-amount income">{formatCurrency(t.amount)}</span>
                            {/* Delete Button */}
                            <button onClick={() => handleDeleteTransaction(t.id)} className="delete-button-history">X</button>
                        </li>
                    ))}
                </ul>
            )}
        </div>

        {/* --- Expense Section --- */}
         <div className="history-type-section">
            <h3>Expenses (-{formatCurrency(groupedByType.expenseTotal)})</h3>
            {groupedByType.expense.length === 0 ? (
                <p className="no-transactions-msg">No expense transactions recorded.</p>
            ) : (
                 <ul>
                     {groupedByType.expense.map(t => (
                         <li key={t.id}>
                            <span className="history-date">{t.transaction_date}</span>
                            <span className="history-category">({t.category_name || 'N/A'})</span>
                            <span className="history-desc">{t.description || <i>(No description)</i>}</span>
                            <span className="history-amount expense">{formatCurrency(t.amount)}</span>
                            <button onClick={() => handleDeleteTransaction(t.id)} className="delete-button-history">X</button>
                         </li>
                     ))}
                 </ul>
            )}
        </div>

        {/* --- Optional: Uncategorized Section --- */}
        {groupedByType.uncategorized.length > 0 && (
             <div className="history-type-section uncategorized">
                <h3>Uncategorized</h3>
                <ul>
                    {groupedByType.uncategorized.map(t => (
                        <li key={t.id}>
                            <span className="history-date">{t.transaction_date}</span>
                            {/* No category name here */}
                            <span className="history-desc">{t.description || <i>(No description)</i>}</span>
                            <span className="history-amount">{formatCurrency(t.amount)}</span>{/* Default color */}
                            <button onClick={() => handleDeleteTransaction(t.id)} className="delete-button-history">X</button>
                        </li>
                    ))}
                </ul>
             </div>
        )}

    </div> // End history-list-section
);
}

export default HistoryPage;