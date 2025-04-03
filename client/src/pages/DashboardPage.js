// client/src/pages/DashboardPage.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

// --- Helper Functions ---
// Parses a string to float safely, returning NaN if invalid
const safeParseFloat = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return NaN;
    // Basic cleaning (remove leading/trailing spaces)
    const cleanedValue = value.trim();
    if (cleanedValue === '') return NaN; // Handle empty string after trim
    const parsed = parseFloat(cleanedValue);
    return isNaN(parsed) ? NaN : parsed;
};

// Formats a number (or numeric string) to 2 decimal places for display
const formatAmountForDisplay = (value) => {
    const num = safeParseFloat(value);
    if (isNaN(num)) {
        return ''; // Return empty string if not a valid number yet
    }
    // Format to 2 decimal places
    return num.toFixed(2);
};

// Added from previous step - needed for category totals
const formatCurrency = (num) => {
    return new Intl.NumberFormat('en-US', { // Adjust locale/currency
      style: 'currency',
      currency: 'USD',
    }).format(num);
};


// --- Component Definition ---
function DashboardPage() {
    // --- State Variables ---
    // Categories
    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [errorCategories, setErrorCategories] = useState(null);

    // Transaction Popup Form State
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState(''); // Amount stored as string
    const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);
    const [submitTransactionError, setSubmitTransactionError] = useState(null);
    const [submitTransactionSuccess, setSubmitTransactionSuccess] = useState(null);

    // Transaction Popup Control State
    const [selectedCategoryForPopup, setSelectedCategoryForPopup] = useState(null); // Stores category object or null

    // Add Category Form State
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [addCategoryError, setAddCategoryError] = useState(null);
    const [addCategorySuccess, setAddCategorySuccess] = useState(null);

    // Category Options Popup State
    const [optionsPopupCategory, setOptionsPopupCategory] = useState(null); // Category object for options, or null
    const [isRenameMode, setIsRenameMode] = useState(false); // Is the options popup in rename mode?
    const [renameCategoryName, setRenameCategoryName] = useState(''); // Input value for renaming
    const [isProcessingCategoryAction, setIsProcessingCategoryAction] = useState(false); // Loading state for rename/delete
    const [categoryActionError, setCategoryActionError] = useState(null); // Error for rename/delete

    // Transactions Data State (for category totals)
    const [transactions, setTransactions] = useState([]);
    const [loadingTransactions, setLoadingTransactions] = useState(true); // Initially loading
    const [errorTransactions, setErrorTransactions] = useState(null);
    const [transactionRefetchTrigger, setTransactionRefetchTrigger] = useState(0); // Trigger for refetching transactions

    // --- Fetch Categories Effect ---
    useEffect(() => {
        const controller = new AbortController();
        const fetchCategories = async () => {
            setLoadingCategories(true);
            setErrorCategories(null);
            try {
                const response = await axios.get('http://localhost:5001/api/categories', { signal: controller.signal });
                setCategories(response.data.sort((a, b) => a.name.localeCompare(b.name)));
            } catch (err) {
                if (!axios.isCancel(err)) { console.error("Error fetching categories:", err); setErrorCategories('Failed to load categories.');}
            } finally {
                 if (!controller.signal.aborted) setLoadingCategories(false);
            }
        };
        fetchCategories();
        return () => controller.abort(); // Cleanup
    }, []);


    // --- Fetch Transactions Effect ---
    useEffect(() => {
        const controller = new AbortController();
        const fetchTransactions = async () => {
            setLoadingTransactions(true);
            setErrorTransactions(null);
            try {
                const response = await axios.get('http://localhost:5001/api/transactions', {
                    signal: controller.signal
                });
                setTransactions(response.data);
            } catch (err) {
                 if (axios.isCancel(err) || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
                     console.log('Fetch transactions request cancelled:', err.message);
                 } else {
                    console.error("Error fetching transactions:", err);
                    setErrorTransactions('Failed to load transactions.');
                 }
            } finally {
                if (!controller.signal.aborted) {
                    setLoadingTransactions(false);
                }
            }
        };
        fetchTransactions();
        return () => { controller.abort(); };
    }, [transactionRefetchTrigger]); // Re-run when the trigger value changes


    // --- Calculate Category Totals using useMemo ---
    const categoryTotals = React.useMemo(() => { // Explicitly use React.useMemo if needed
        if (loadingTransactions || !transactions) {
            return {}; // Return empty object while loading
        }
        const totals = {};
        transactions.forEach(transaction => {
            const transactionAmount = safeParseFloat(transaction.amount);
            if (isNaN(transactionAmount)) return;
            const categoryId = transaction.category_id;
            if (categoryId !== null && categoryId !== undefined) {
                totals[categoryId] = (totals[categoryId] || 0) + transactionAmount;
            }
        });
        return totals;
    }, [transactions, loadingTransactions]);


    // --- Utility to clear Transaction form fields ---
    const clearTransactionFormFields = () => {
        setDescription('');
        setAmount('');
        setSubmitTransactionError(null);
        setSubmitTransactionSuccess(null);
    };

    // --- Transaction Popup Handlers ---
    const handleCategoryBoxClick = (category) => {
         if (optionsPopupCategory?.id === category.id) return; // Don't open if options popup is open for this one
        setSelectedCategoryForPopup(category);
        clearTransactionFormFields();
    };

    const handleClosePopup = () => {
        setSelectedCategoryForPopup(null);
        clearTransactionFormFields();
    };

    // --- Amount Handlers ---
    const handleAmountCalculation = (inputValue) => {
        const currentNumericAmount = safeParseFloat(amount) || 0;
        const trimmedInput = inputValue.trim();
        let newNumericAmount = currentNumericAmount;

        if (trimmedInput === '') { newNumericAmount = 0; }
        else if (['+', '-', '*', '/'].includes(trimmedInput[0])) {
            const operator = trimmedInput[0];
            const valueStr = trimmedInput.substring(1);
            const operand = safeParseFloat(valueStr);
            if (!isNaN(operand)) {
                switch (operator) {
                    case '+': newNumericAmount = currentNumericAmount + operand; break;
                    case '-': newNumericAmount = currentNumericAmount - operand; break;
                    case '*': newNumericAmount = currentNumericAmount * operand; break;
                    case '/':
                        if (operand !== 0) { newNumericAmount = currentNumericAmount / operand; }
                        else { console.error("Division by zero attempted"); newNumericAmount = currentNumericAmount; }
                        break;
                    default: newNumericAmount = currentNumericAmount;
                }
            } else { newNumericAmount = currentNumericAmount; }
        } else {
            const directValue = safeParseFloat(trimmedInput);
            if (!isNaN(directValue)) { newNumericAmount = directValue; }
            else { newNumericAmount = currentNumericAmount; }
        }
        setAmount(formatAmountForDisplay(newNumericAmount));
    };

    const handleQuickAdd = (addValue) => {
        const currentNumericAmount = safeParseFloat(amount) || 0;
        const newNumericAmount = currentNumericAmount + addValue;
        setAmount(formatAmountForDisplay(newNumericAmount));
    };

    // --- Transaction Form Submission Handler ---
    const handleTransactionSubmit = async (event) => {
        event.preventDefault();
        if (!selectedCategoryForPopup) { setSubmitTransactionError('No category selected.'); return; }
        const finalAmount = safeParseFloat(amount);
        if (isNaN(finalAmount)) { setSubmitTransactionError('Please enter a valid amount.'); setSubmitTransactionSuccess(null); return; }

        const currentDate = new Date().toISOString().split('T')[0];
        const transactionData = { description: description || null, amount: finalAmount, transaction_date: currentDate, category_id: selectedCategoryForPopup.id };

        setIsSubmittingTransaction(true);
        setSubmitTransactionError(null);
        setSubmitTransactionSuccess(null);
        try {
            await axios.post('http://localhost:5001/api/transactions', transactionData);
            setSubmitTransactionSuccess(`Transaction for ${selectedCategoryForPopup.name} added!`);
            setTransactionRefetchTrigger(prev => prev + 1); // Trigger transaction refetch for totals
            setTimeout(() => { handleClosePopup(); }, 1500);
        } catch (err) {
            console.error('Error submitting transaction:', err);
            let errorMessage = 'Failed to add transaction.';
            if (err.response?.data?.message) { errorMessage = err.response.data.message; }
            setSubmitTransactionError(errorMessage);
            setSubmitTransactionSuccess(null);
        } finally {
             setTimeout(() => setIsSubmittingTransaction(false), 500);
        }
    };


    // --- Category Add Handler ---
    const handleAddCategorySubmit = async (event) => {
        event.preventDefault();
        const trimmedName = newCategoryName.trim();
        if (!trimmedName) { setAddCategoryError("Category name cannot be empty."); return; }

        setIsAddingCategory(true);
        setAddCategoryError(null);
        setAddCategorySuccess(null);
        try {
            const response = await axios.post('http://localhost:5001/api/categories', { name: trimmedName });
            setAddCategoryError(null);
            setCategories(prevCategories => [...prevCategories, response.data.newCategory].sort((a, b) => a.name.localeCompare(b.name)));
            setNewCategoryName('');
            setAddCategorySuccess(`Category '${response.data.newCategory.name}' added!`);
            setTransactionRefetchTrigger(prev => prev + 1); // Refetch transactions in case totals need updating (e.g., for uncategorized if it exists)
            setTimeout(() => setAddCategorySuccess(null), 3000);
        } catch (err) {
            console.error("Error adding category:", err);
            let message = "Failed to add category.";
            if (err.response?.data?.message) { message = err.response.data.message; }
            setAddCategoryError(message);
            setAddCategorySuccess(null);
        } finally {
            setIsAddingCategory(false);
        }
    };

    // --- Category Options Popup Handlers ---
    const handleOptionsIconClick = (event, category) => {
        event.stopPropagation();
        setOptionsPopupCategory(category);
        setRenameCategoryName(category.name);
        setIsRenameMode(false);
        setCategoryActionError(null);
    };

    const handleCloseOptionsPopup = () => {
        setOptionsPopupCategory(null);
        setIsRenameMode(false);
        setRenameCategoryName('');
        setCategoryActionError(null);
    };

    const handleTriggerRename = () => { setIsRenameMode(true); setCategoryActionError(null); };
    const handleCancelRename = () => { setIsRenameMode(false); setRenameCategoryName(optionsPopupCategory ? optionsPopupCategory.name : ''); setCategoryActionError(null); };

    // --- Rename Category Submit Handler ---
    const handleRenameCategorySubmit = async (event) => {
        event.preventDefault();
        if (!optionsPopupCategory) return;
        const categoryId = optionsPopupCategory.id;
        const newName = renameCategoryName.trim();
        if (!newName) { setCategoryActionError("New name cannot be empty."); return; }
        if (newName === optionsPopupCategory.name) { handleCancelRename(); return; }

        setIsProcessingCategoryAction(true);
        setCategoryActionError(null);
        try {
            const response = await axios.put(`http://localhost:5001/api/categories/${categoryId}`, { name: newName });
            setCategories(prevCategories => prevCategories.map(cat => cat.id === categoryId ? response.data.updatedCategory : cat).sort((a, b) => a.name.localeCompare(b.name)));
            setTransactionRefetchTrigger(prev => prev + 1); // Refetch transactions
            handleCloseOptionsPopup();
        } catch (err) {
            console.error("Error renaming category:", err);
            let message = "Failed to rename category.";
            if (err.response?.data?.message) { message = err.response.data.message; }
            setCategoryActionError(message);
        } finally {
            setIsProcessingCategoryAction(false);
        }
    };

    // --- Delete Category Handler ---
    const handleDeleteCategory = async (categoryId, categoryName) => {
        if (!window.confirm(`Are you sure you want to delete the category "${categoryName}"? Transactions using this category will be unlinked.`)) return;

        setIsProcessingCategoryAction(true);
        setCategoryActionError(null);
        try {
            await axios.delete(`http://localhost:5001/api/categories/${categoryId}`);
            setCategories(prevCategories => prevCategories.filter(cat => cat.id !== categoryId));
            setTransactionRefetchTrigger(prev => prev + 1); // Refetch transactions
            handleCloseOptionsPopup();
        } catch (err) {
            console.error("Error deleting category:", err);
             let message = "Failed to delete category.";
            if (err.response?.data?.message) { message = err.response.data.message; }
            setCategoryActionError(message);
        } finally {
             setIsProcessingCategoryAction(false);
        }
    };


    // --- Render Logic ---
    const isLoading = loadingCategories; // Base loading on categories for now
    // Can refine loading state later if needed

    if (isLoading) {
        return <div>Loading dashboard data...</div>;
    }
    if (errorCategories && categories.length === 0) {
        return <div style={{ color: 'red', padding: '20px' }}>Error loading categories: {errorCategories}. Cannot display dashboard.</div>;
    }

    // --- Main Return Statement ---
    return (
        <> {/* React Fragment */}
            <div className="main-layout-single-column">
                <section className="categories-display-section-full">
                    <h2>Categories</h2>
                    {/* Optional: Display Transaction Loading Errors Here */}
                    {errorTransactions && !loadingTransactions && <p style={{ color: 'orange', marginBottom: '15px' }}>Warning: Could not load transaction data. Totals may be inaccurate.</p>}

                    {/* Category Grid Display */}
                    {categories.length === 0 && !loadingCategories ? (
                         <p>No categories defined yet. Add one below!</p>
                    ) : (
                        <div className="category-grid">
                            {categories.map(category => {
                                // Get total for this category, default to 0
                                const total = categoryTotals[category.id] || 0;
                                return (
                                    <div
                                        key={category.id}
                                        className="category-select-box"
                                        onClick={() => handleCategoryBoxClick(category)}
                                    >
                                        {/* Options Icon */}
                                        <button
                                            className="category-options-btn"
                                            onClick={(e) => handleOptionsIconClick(e, category)}
                                            title="Category Options"
                                            disabled={isProcessingCategoryAction && optionsPopupCategory?.id === category.id}
                                        >
                                            ⚙️
                                        </button>
                                        {/* Category Name */}
                                        <h3>{category.name}</h3>
                                        {/* Display Category Total */}
                                        <p className="category-total">
                                            {/* Show loading dots for total only if transactions are loading */}
                                            {loadingTransactions ? '...' : formatCurrency(total)}
                                        </p>
                                    </div>
                                );
                             })}
                        </div>
                    )}

                    {/* Add Category Form */}
                    <div className="add-category-container">
                        <form onSubmit={handleAddCategorySubmit} className="add-category-form">
                            <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => {
                                    setNewCategoryName(e.target.value);
                                    if (addCategoryError) setAddCategoryError(null);
                                }}
                                placeholder="New category name..."
                                disabled={isAddingCategory}
                                maxLength="100"
                                aria-describedby="category-add-status"
                            />
                            <button type="submit" disabled={isAddingCategory || !newCategoryName.trim()}>
                                {isAddingCategory ? 'Adding...' : 'Add Category'}
                            </button>
                        </form>
                        <div id="category-add-status" className="category-add-status-container">
                            {addCategoryError && <span className="category-add-status error">{addCategoryError}</span>}
                            {addCategorySuccess && <span className="category-add-status success">{addCategorySuccess}</span>}
                        </div>
                    </div>
                </section>
            </div>

            {/* --- Popup/Modal for Adding Transaction --- */}
            {selectedCategoryForPopup && (
                <div className="popup-overlay" onClick={handleClosePopup}>
                    <div className="popup-container" onClick={(e) => e.stopPropagation()}>
                        {/* Panel 1: Main Form Content */}
                        <div className="popup-content-main">
                            <h2>Add Transaction for: {selectedCategoryForPopup.name}</h2>
                            {submitTransactionError && <p style={{ color: 'red', marginTop: '-10px', marginBottom: '15px' }}>Error: {submitTransactionError}</p>}
                            {submitTransactionSuccess && <p style={{ color: 'green', marginTop: '-10px', marginBottom: '15px' }}>{submitTransactionSuccess}</p>}
                            <form onSubmit={handleTransactionSubmit} className="popup-form">
                                {/* Amount Input */}
                                <div><label htmlFor="amount">Amount:</label><input type="text" inputMode="decimal" id="amount" className="input-amount" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAmountCalculation(e.target.value); }}} onBlur={(e) => handleAmountCalculation(e.target.value)} placeholder="0.00 or +5, -10 etc." required disabled={isSubmittingTransaction} autoFocus /></div>
                                {/* Description Input */}
                                <div><label htmlFor="description">Description (Optional):</label><input type="text" id="description" className="input-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details..." disabled={isSubmittingTransaction} /></div>
                                {/* Category Display */}
                                <div className="form-category-display"><label>Category:</label><span>{selectedCategoryForPopup.name}</span></div>
                                {/* Button Group */}
                                <div className="popup-button-group"><button type="button" onClick={handleClosePopup} className="popup-cancel-btn" disabled={isSubmittingTransaction}>Cancel</button><button type="submit" className="popup-submit-btn" disabled={isSubmittingTransaction}>{isSubmittingTransaction ? 'Adding...' : 'Add Transaction'}</button></div>
                            </form>
                        </div>
                        {/* Panel 2: Quick Add Buttons */}
                        <div className="quick-add-panel">
                            <h4>Quick Add</h4>
                            <div className="quick-add-buttons">
                                <button type="button" onClick={() => handleQuickAdd(1)} disabled={isSubmittingTransaction}>+1</button>
                                <button type="button" onClick={() => handleQuickAdd(5)} disabled={isSubmittingTransaction}>+5</button>
                                <button type="button" onClick={() => handleQuickAdd(10)} disabled={isSubmittingTransaction}>+10</button>
                                <button type="button" onClick={() => handleQuickAdd(20)} disabled={isSubmittingTransaction}>+20</button>
                                <button type="button" onClick={() => handleQuickAdd(-1)} disabled={isSubmittingTransaction}>-1</button>
                                <button type="button" onClick={() => handleQuickAdd(-5)} disabled={isSubmittingTransaction}>-5</button>
                                <button type="button" onClick={() => handleQuickAdd(-10)} disabled={isSubmittingTransaction}>-10</button>
                                <button type="button" onClick={() => handleQuickAdd(-20)} disabled={isSubmittingTransaction}>-20</button>
                                <button type="button" onClick={() => setAmount(formatAmountForDisplay(5))} disabled={isSubmittingTransaction}>Set 5</button>
                                <button type="button" onClick={() => setAmount(formatAmountForDisplay(10))} disabled={isSubmittingTransaction}>Set 10</button>
                                <button type="button" onClick={() => setAmount(formatAmountForDisplay(20))} disabled={isSubmittingTransaction}>Set 20</button>
                                <button type="button" onClick={() => setAmount(formatAmountForDisplay(50))} disabled={isSubmittingTransaction}>Set 50</button>
                                <button type="button" onClick={() => setAmount(formatAmountForDisplay(100))} disabled={isSubmittingTransaction}>Set 100</button>
                            </div>
                            <div className="quick-add-clear-container">
                                <button type="button" className="clear-button" onClick={() => setAmount('0.00')} disabled={isSubmittingTransaction}> Clear (0) </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- Category Options Popup/Modal --- */}
            {optionsPopupCategory && (
                <div className="popup-overlay options-overlay" onClick={handleCloseOptionsPopup}>
                    <div className="options-popup-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Options for: {optionsPopupCategory.name}</h3>
                        {categoryActionError && <p className="options-error">{categoryActionError}</p>}
                        {isRenameMode ? (
                            <form onSubmit={handleRenameCategorySubmit} className="rename-form">
                                <label htmlFor="rename-category">New Name:</label>
                                <input id="rename-category" type="text" value={renameCategoryName} onChange={(e) => { setRenameCategoryName(e.target.value); if (categoryActionError) setCategoryActionError(null); }} disabled={isProcessingCategoryAction} maxLength="100" autoFocus />
                                <div className="options-button-group">
                                    <button type="button" onClick={handleCancelRename} disabled={isProcessingCategoryAction}>Cancel</button>
                                    <button type="submit" disabled={isProcessingCategoryAction || !renameCategoryName.trim() || renameCategoryName.trim() === optionsPopupCategory.name}> {isProcessingCategoryAction ? 'Saving...' : 'Save'} </button>
                                </div>
                            </form>
                        ) : (
                            <div className="options-button-group">
                                <button className="delete-button" onClick={() => handleDeleteCategory(optionsPopupCategory.id, optionsPopupCategory.name)} disabled={isProcessingCategoryAction}> Delete </button>
                                <button onClick={handleTriggerRename} disabled={isProcessingCategoryAction}>Rename</button>
                                <button onClick={handleCloseOptionsPopup} disabled={isProcessingCategoryAction}>Cancel</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </> // End React Fragment
    );
} // End of DashboardPage component

export default DashboardPage; // Export the component