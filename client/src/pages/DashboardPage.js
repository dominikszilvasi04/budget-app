// client/src/pages/DashboardPage.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';

// --- Helper Functions ---
const safeParseFloat = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return NaN;
    const cleanedValue = value.trim();
    if (cleanedValue === '') return NaN;
    const parsed = parseFloat(cleanedValue);
    return isNaN(parsed) ? NaN : parsed;
};

const formatAmountForDisplay = (value) => {
    const num = safeParseFloat(value);
    if (isNaN(num)) { return ''; }
    return num.toFixed(2);
};

const formatCurrency = (num) => {
    const parsedNum = typeof num === 'number' ? num : safeParseFloat(num);
    if (isNaN(parsedNum)) { num = 0; } else { num = parsedNum; }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

function getContrastYIQ(hexcolor, lightened = false){
    if (!hexcolor || typeof hexcolor !== 'string') return lightened ? '#e0e0e0' : '#000000';
    hexcolor = hexcolor.replace("#", "");
    if (hexcolor.length !== 6 || !/^[0-9A-F]{6}$/i.test(hexcolor)) { return lightened ? '#e0e0e0' : '#000000'; }
	const r = parseInt(hexcolor.substr(0,2),16); const g = parseInt(hexcolor.substr(2,2),16); const b = parseInt(hexcolor.substr(4,2),16);
	const yiq = ((r*299)+(g*587)+(b*114))/1000;
    const color = (yiq >= 128) ? '#000000' : '#FFFFFF';
    if (lightened) { return (yiq >= 128) ? '#dddddd' : '#555555'; }
	return color;
}



// --- Component Definition ---
function DashboardPage() {
    // --- State Variables ---
    const [categories, setCategories] = useState([]); // ALL categories
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [errorCategories, setErrorCategories] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [loadingTransactions, setLoadingTransactions] = useState(true);
    const [errorTransactions, setErrorTransactions] = useState(null);
    const [budgetData, setBudgetData] = useState([]);
    const [loadingBudgets, setLoadingBudgets] = useState(true);
    const [errorBudgets, setErrorBudgets] = useState(null);
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);
    const [submitTransactionError, setSubmitTransactionError] = useState(null);
    const [submitTransactionSuccess, setSubmitTransactionSuccess] = useState(null);
    const [selectedCategoryForPopup, setSelectedCategoryForPopup] = useState(null);
    const [newCategoryName, setNewCategoryName] = useState('');
    // ** NEW: State for Category Type in Add Form **
    const [newCategoryType, setNewCategoryType] = useState('expense'); // Default to expense
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [addCategoryError, setAddCategoryError] = useState(null);
    const [addCategorySuccess, setAddCategorySuccess] = useState(null);
    const [optionsPopupCategory, setOptionsPopupCategory] = useState(null);
    const [isRenameMode, setIsRenameMode] = useState(false);
    const [renameCategoryName, setRenameCategoryName] = useState('');
    const [isProcessingCategoryAction, setIsProcessingCategoryAction] = useState(false);
    const [categoryActionError, setCategoryActionError] = useState(null);
    const [selectedColor, setSelectedColor] = useState('#FFFFFF');
    const [transactionRefetchTrigger, setTransactionRefetchTrigger] = useState(0);
    // ** NEW: State for Dashboard View Type **
    const [dashboardViewType, setDashboardViewType] = useState('expense'); // 'expense' or 'income'

    // --- Fetch Categories Effect ---
    useEffect(() => {
        const controller = new AbortController();
        const fetchCategories = async () => {
            setLoadingCategories(true); setErrorCategories(null);
            try {
                const response = await axios.get('http://localhost:5001/api/categories', { signal: controller.signal });
                setCategories(response.data.sort((a, b) => a.name.localeCompare(b.name)));
            } catch (err) {
                if (!axios.isCancel(err)) { console.error("Error fetching categories:", err); setErrorCategories('Failed to load categories.');}
            } finally { if (!controller.signal.aborted) setLoadingCategories(false); }
        };
        fetchCategories();
        return () => controller.abort();
    }, []);

    // --- Fetch Transactions Effect ---
    useEffect(() => {
        const controller = new AbortController();
        const fetchTransactions = async () => {
            setLoadingTransactions(true); setErrorTransactions(null);
            try {
                const response = await axios.get('http://localhost:5001/api/transactions', { signal: controller.signal });
                setTransactions(response.data);
            } catch (err) {
                 if (axios.isCancel(err) || err.name === 'CanceledError' || err.code === 'ERR_CANCELED') { console.log('Fetch transactions request cancelled:', err.message); }
                 else { console.error("Error fetching transactions:", err); setErrorTransactions('Failed to load transactions.'); }
            } finally { if (!controller.signal.aborted) setLoadingTransactions(false); }
        };
        fetchTransactions();
        return () => { controller.abort(); };
    }, [transactionRefetchTrigger]);

    // --- Fetch Budgets Effect ---
    useEffect(() => {
        const controller = new AbortController();
        const fetchBudgets = async () => {
            setLoadingBudgets(true); setErrorBudgets(null);
            try {
                const response = await axios.get('http://localhost:5001/api/budgets/current', { signal: controller.signal });
                setBudgetData(response.data);
            } catch (err) {
                if (!axios.isCancel(err)) { console.error("Error fetching budget data:", err); setErrorBudgets('Failed to load budget data.'); }
            } finally { if (!controller.signal.aborted) setLoadingBudgets(false); }
        };
        fetchBudgets();
        return () => { controller.abort(); };
    }, [transactionRefetchTrigger]);


    // --- Calculate Category Totals ---
    const categoryTotals = useMemo(() => {
        if (loadingTransactions || !transactions) { return {}; }
        const totals = {};
        transactions.forEach(transaction => {
            const transactionAmount = safeParseFloat(transaction.amount);
            if (isNaN(transactionAmount)) return;
            const categoryId = transaction.category_id;
            if (categoryId !== null && categoryId !== undefined) { totals[categoryId] = (totals[categoryId] || 0) + transactionAmount; }
        });
        return totals;
    }, [transactions, loadingTransactions]);

    // --- Budget Map ---
    const budgetMap = useMemo(() => {
        if (loadingBudgets || !budgetData) { return {}; }
        const map = {};
        budgetData.forEach(item => { map[item.id] = item.budget_amount ?? 0.00; });
        return map;
    }, [budgetData, loadingBudgets]);

    // --- ** Filtered Categories based on View Type ** ---
    const filteredCategories = useMemo(() => {
        return categories.filter(cat => cat.type === dashboardViewType);
    }, [categories, dashboardViewType]); // Re-filter when categories or view type change

    // --- Handlers ---
    const clearTransactionFormFields = () => {
        setDescription(''); setAmount(''); setSubmitTransactionError(null); setSubmitTransactionSuccess(null);
    };
    const handleCategoryBoxClick = (category) => {
         if (optionsPopupCategory?.id === category.id) return;
        setSelectedCategoryForPopup(category); clearTransactionFormFields();
    };
    const handleClosePopup = () => {
        setSelectedCategoryForPopup(null); clearTransactionFormFields();
    };
    const handleAmountCalculation = (inputValue) => {
        const currentNumericAmount = safeParseFloat(amount) || 0;
        const trimmedInput = inputValue.trim(); let newNumericAmount = currentNumericAmount;
        if (trimmedInput === '') { newNumericAmount = 0; }
        else if (['+', '-', '*', '/'].includes(trimmedInput[0])) {
            const operator = trimmedInput[0]; const valueStr = trimmedInput.substring(1); const operand = safeParseFloat(valueStr);
            if (!isNaN(operand)) {
                switch (operator) {
                    case '+': newNumericAmount = currentNumericAmount + operand; break;
                    case '-': newNumericAmount = currentNumericAmount - operand; break;
                    case '*': newNumericAmount = currentNumericAmount * operand; break;
                    case '/': if (operand !== 0) { newNumericAmount = currentNumericAmount / operand; } else { console.error("Div/0"); newNumericAmount = currentNumericAmount; } break;
                    default: newNumericAmount = currentNumericAmount;
                }
            } else { newNumericAmount = currentNumericAmount; }
        } else { const directValue = safeParseFloat(trimmedInput); if (!isNaN(directValue)) { newNumericAmount = directValue; } else { newNumericAmount = currentNumericAmount; } }
        setAmount(formatAmountForDisplay(newNumericAmount));
    };
    const handleQuickAdd = (addValue) => {
        const currentNumericAmount = safeParseFloat(amount) || 0; const newNumericAmount = currentNumericAmount + addValue; setAmount(formatAmountForDisplay(newNumericAmount));
    };
    const handleTransactionSubmit = async (event) => {
        event.preventDefault(); if (!selectedCategoryForPopup) { setSubmitTransactionError('No category selected.'); return; }
        const finalAmount = safeParseFloat(amount); if (isNaN(finalAmount)) { setSubmitTransactionError('Please enter a valid amount.'); setSubmitTransactionSuccess(null); return; }
        const currentDate = new Date().toISOString().split('T')[0];
        const transactionData = { description: description || null, amount: finalAmount, transaction_date: currentDate, category_id: selectedCategoryForPopup.id };
        setIsSubmittingTransaction(true); setSubmitTransactionError(null); setSubmitTransactionSuccess(null);
        try { await axios.post('http://localhost:5001/api/transactions', transactionData); setSubmitTransactionSuccess(`Transaction for ${selectedCategoryForPopup.name} added!`); setTransactionRefetchTrigger(prev => prev + 1); setTimeout(() => { handleClosePopup(); }, 1500); }
        catch (err) { console.error('Error submitting transaction:', err); let errorMessage = 'Failed.'; if (err.response?.data?.message) { errorMessage = err.response.data.message; } setSubmitTransactionError(errorMessage); setSubmitTransactionSuccess(null); }
        finally { setTimeout(() => setIsSubmittingTransaction(false), 500); }
    };
    // --- ** Modified Category Add Handler ** ---
    // --- Category Add Handler (with more logging) ---
    const handleAddCategorySubmit = async (event) => {
        event.preventDefault();
        const trimmedName = newCategoryName.trim();
        if (!trimmedName) {
            setAddCategoryError("Category name cannot be empty.");
            return;
        }

        console.log("Attempting to add category:", trimmedName); // Log start
        setIsAddingCategory(true); // Set loading TRUE
        setAddCategoryError(null);
        setAddCategorySuccess(null);

        try {
            const response = await axios.post('http://localhost:5001/api/categories', {
                name: trimmedName,
                type: newCategoryType
            });

            // Success path:
            console.log("Category added successfully:", response.data); // Log success
            setAddCategoryError(null);
            setCategories(prevCategories =>
                [...prevCategories, response.data.newCategory].sort((a, b) =>
                    a.name.localeCompare(b.name)
                 )
            );
            setNewCategoryName(''); // Clear input
            setAddCategorySuccess(`Category '${response.data.newCategory.name}' added!`);
            setTransactionRefetchTrigger(p => p + 1);
            setTimeout(() => setAddCategorySuccess(null), 3000);

        } catch (err) {
            // Error path:
            console.error("Error adding category:", err); // Log the full error
            let message = "Failed to add category.";
            if (err.response && err.response.data && err.response.data.message) {
                message = err.response.data.message;
            }
             console.log("Setting add category error state:", message); // Log before setting error state
            setAddCategoryError(message);
            setAddCategorySuccess(null);

        } finally {
            // --- This block MUST run ---
            console.log("Executing finally block for add category..."); // Log entry into finally
            setIsAddingCategory(false); // Set loading FALSE
            console.log("isAddingCategory state should now be false."); // Log after setting state
            // --- End Finally ---
        }
    };
    const handleOptionsIconClick = (event, category) => {
        event.stopPropagation(); setOptionsPopupCategory(category); setRenameCategoryName(category.name); setSelectedColor(category.color || '#FFFFFF'); setIsRenameMode(false); setCategoryActionError(null);
    };
    const handleCloseOptionsPopup = () => {
        setOptionsPopupCategory(null); setIsRenameMode(false); setRenameCategoryName(''); setSelectedColor('#FFFFFF'); setCategoryActionError(null);
    };
    const handleTriggerRename = () => { setIsRenameMode(true); setCategoryActionError(null); };
    const handleCancelRename = () => { setIsRenameMode(false); setRenameCategoryName(optionsPopupCategory ? optionsPopupCategory.name : ''); setCategoryActionError(null); /* Don't reset color on cancel rename */ };
    // Combined Update Handler
    const handleUpdateCategorySubmit = async (event) => {
        event.preventDefault(); if (!optionsPopupCategory) return;
        const categoryId = optionsPopupCategory.id;
        const newNameTrimmed = renameCategoryName.trim();
        const originalName = optionsPopupCategory.name;
        const originalColor = optionsPopupCategory.color || '#FFFFFF';
        const newColor = selectedColor;
        const isNameChanged = isRenameMode && newNameTrimmed && newNameTrimmed !== originalName;
        const isColorChanged = newColor !== originalColor;
        if (!isNameChanged && !isColorChanged) { handleCloseOptionsPopup(); return; } // Nothing changed
        if (isNameChanged && !newNameTrimmed) { setCategoryActionError("New name cannot be empty."); return; }

        setIsProcessingCategoryAction(true); setCategoryActionError(null);
        const payload = {};
        if (isNameChanged) payload.name = newNameTrimmed;
        if (isColorChanged) payload.color = newColor;
        try { const response = await axios.put(`http://localhost:5001/api/categories/${categoryId}`, payload); setCategories(prev => prev.map(c => c.id === categoryId ? response.data.updatedCategory : c).sort((a, b) => a.name.localeCompare(b.name))); setTransactionRefetchTrigger(p => p + 1); handleCloseOptionsPopup(); }
        catch (err) { console.error("Error updating category:", err); let message = "Failed."; if (err.response?.data?.message) { message = err.response.data.message; } setCategoryActionError(message); }
        finally { setIsProcessingCategoryAction(false); }
    };
    const handleDeleteCategory = async (categoryId, categoryName) => {
        if (!window.confirm(`Delete "${categoryName}"? Transactions will be unlinked.`)) return;
        setIsProcessingCategoryAction(true); setCategoryActionError(null);
        try { await axios.delete(`http://localhost:5001/api/categories/${categoryId}`); setCategories(prev => prev.filter(c => c.id !== categoryId)); setTransactionRefetchTrigger(p => p + 1); handleCloseOptionsPopup(); }
        catch (err) { console.error("Error deleting category:", err); let message = "Failed."; if (err.response?.data?.message) { message = err.response.data.message; } setCategoryActionError(message); }
        finally { setIsProcessingCategoryAction(false); }
    };

    // --- Render Logic ---
    const isLoading = loadingCategories; // Base loading on categories
    if (isLoading) { return <div>Loading dashboard data...</div>; }
    if (errorCategories && categories.length === 0) { return <div style={{ color: 'red', padding: '20px' }}>Error loading categories: {errorCategories}. Cannot display dashboard.</div>; }
    const displayDataError = errorTransactions || errorBudgets; // Non-critical data errors

    return (
        <> {/* React Fragment */}
            <div className="main-layout-single-column">
                <section className="categories-display-section-full">
                    {/* Section Header with Title and Toggle */}
                    <div className="section-header-controls">
                        {/* Title changes based on view type */}
                        <h2>{dashboardViewType === 'expense' ? 'Expense Categories' : 'Income Sources'}</h2>
                        {/* View Type Toggle Buttons */}
                        <div className="view-toggle">
                            <button
                                className={`toggle-btn ${dashboardViewType === 'expense' ? 'active' : ''}`}
                                onClick={() => setDashboardViewType('expense')}
                            >
                                Expenses
                            </button>
                            <button
                                className={`toggle-btn ${dashboardViewType === 'income' ? 'active' : ''}`}
                                onClick={() => setDashboardViewType('income')}
                            >
                                Income
                            </button>
                        </div>
                    </div>

                    {/* Optional Data Error Display */}
                    {displayDataError && !isLoading && <p style={{ color: 'orange', marginBottom: '15px' }}>Warning: Could not load all data. Totals/Budgets may be inaccurate. ({displayDataError})</p>}

                    {/* Category Grid Display - Uses FILTERED categories */}
                    {filteredCategories.length === 0 && !loadingCategories ? (
                         <p>No {dashboardViewType} categories defined yet. Add one below!</p>
                    ) : (
                        <div className="category-grid">
                            {/* Map over FILTERED categories */}
                            {filteredCategories.map(category => {
                                const allocatedBudget = budgetMap[category.id] ?? 0.00;
                                const totalSpentOrReceived = categoryTotals[category.id] ?? 0.00; // Rename for clarity
                                const difference = allocatedBudget - totalSpentOrReceived; // Relevant mainly for expenses
                                const boxColor = category.color || '#FFFFFF';
                                const textColor = getContrastYIQ(boxColor);
                                const borderColor = getContrastYIQ(boxColor, true);
                                const optionsColor = textColor === '#000000' ? '#6c757d' : '#cccccc';

                                return (
                                    <div key={category.id} className="category-select-box" onClick={() => handleCategoryBoxClick(category)} style={{ backgroundColor: boxColor }}>
                                        <button className="category-options-btn" onClick={(e) => handleOptionsIconClick(e, category)} title="Category Options" style={{ color: optionsColor }} disabled={isProcessingCategoryAction && optionsPopupCategory?.id === category.id}>⚙️</button>
                                        <h3 style={{ color: textColor }}>{category.name}</h3>

                                        {/* Conditional Financial Display */}
                                        {dashboardViewType === 'expense' ? (
                                            <>
                                                <div className="category-financials" style={{ color: textColor, borderTopColor: borderColor }}>
                                                    <p className="category-budget">Budget: <span>{formatCurrency(allocatedBudget)}</span></p>
                                                    <p className={`category-difference ${difference >= 0 ? 'positive' : 'negative'}`}>
                                                        {difference >= 0 ? 'Remaining:' : 'Overspent:'}
                                                        <span style={{ color: difference >= 0 ? '#28a745' : '#dc3545' }}>{formatCurrency(Math.abs(difference))}</span>
                                                    </p>
                                                </div>
                                                <p className="category-spent-total" style={{ color: textColor }}>Spent: {formatCurrency(totalSpentOrReceived)}</p>
                                            </>
                                        ) : ( // Income View
                                            <>
                                                {/* Hide Budget/Difference for Income, just show total */}
                                                <p className="category-spent-total income" style={{ color: textColor, marginTop: 'auto', paddingTop: '10px', borderTop: `1px dashed ${borderColor}` }}>
                                                    Received: {formatCurrency(totalSpentOrReceived)}
                                                </p>
                                            </>
                                        )}
                                    </div> // End category-select-box
                                );
                             })}
                        </div> // End category-grid
                    )}

                    {/* Add Category Form (Modified) */}
                    <div className="add-category-container">
                        <form onSubmit={handleAddCategorySubmit} className="add-category-form">
                            <input type="text" value={newCategoryName} onChange={(e) => { setNewCategoryName(e.target.value); if (addCategoryError) setAddCategoryError(null); }} placeholder="New category name..." disabled={isAddingCategory} maxLength="100" aria-describedby="category-add-status" />
                            {/* Type Selector */}
                            <select
                                value={newCategoryType}
                                onChange={(e) => setNewCategoryType(e.target.value)}
                                disabled={isAddingCategory}
                                className="add-category-type-select"
                            >
                                <option value="expense">Expense</option>
                                <option value="income">Income</option>
                            </select>
                            <button type="submit" disabled={isAddingCategory || !newCategoryName.trim()}> {isAddingCategory ? 'Adding...' : 'Add Category'} </button>
                        </form>
                        <div id="category-add-status" className="category-add-status-container">
                            {addCategoryError && <span className="category-add-status error">{addCategoryError}</span>}
                            {addCategorySuccess && <span className="category-add-status success">{addCategorySuccess}</span>}
                        </div>
                    </div>
                </section>
            </div>

            {/* Transaction Popup */}
            {selectedCategoryForPopup && (
                 <div className="popup-overlay" onClick={handleClosePopup}>
                    <div className="popup-container" onClick={(e) => e.stopPropagation()}>
                        <div className="popup-content-main">
                            <h2>Add Transaction for: {selectedCategoryForPopup.name}</h2>
                            {submitTransactionError && <p style={{ color: 'red', marginTop: '-10px', marginBottom: '15px' }}>Error: {submitTransactionError}</p>}
                            {submitTransactionSuccess && <p style={{ color: 'green', marginTop: '-10px', marginBottom: '15px' }}>{submitTransactionSuccess}</p>}
                            <form onSubmit={handleTransactionSubmit} className="popup-form">
                                <div><label htmlFor="amount">Amount:</label><input type="text" inputMode="decimal" id="amount" className="input-amount" value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAmountCalculation(e.target.value); }}} onBlur={(e) => handleAmountCalculation(e.target.value)} placeholder="0.00 or +5, -10 etc." required disabled={isSubmittingTransaction} autoFocus /></div>
                                <div><label htmlFor="description">Description (Optional):</label><input type="text" id="description" className="input-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details..." disabled={isSubmittingTransaction} /></div>
                                <div className="form-category-display"><label>Category:</label><span>{selectedCategoryForPopup.name}</span></div>
                                <div className="popup-button-group"><button type="button" onClick={handleClosePopup} className="popup-cancel-btn" disabled={isSubmittingTransaction}>Cancel</button><button type="submit" className="popup-submit-btn" disabled={isSubmittingTransaction}>{isSubmittingTransaction ? 'Adding...' : 'Add Transaction'}</button></div>
                            </form>
                        </div>
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

            {/* Category Options Popup */}
            {optionsPopupCategory && (
                <div className="popup-overlay options-overlay" onClick={handleCloseOptionsPopup}>
                    <div className="options-popup-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Options for: {optionsPopupCategory.name}</h3>
                        {categoryActionError && <p className="options-error">{categoryActionError}</p>}
                        <div className="options-color-picker">
                             <label htmlFor="category-color">Color:</label>
                             <input type="color" id="category-color" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} disabled={isProcessingCategoryAction} />
                             <span>{selectedColor}</span>
                        </div>
                        {isRenameMode ? (
                            <form onSubmit={handleUpdateCategorySubmit} className="rename-form">
                                <label htmlFor="rename-category">New Name:</label>
                                <input id="rename-category" type="text" value={renameCategoryName} onChange={(e) => { setRenameCategoryName(e.target.value); if (categoryActionError) setCategoryActionError(null); }} disabled={isProcessingCategoryAction} maxLength="100" autoFocus />
                                <div className="options-button-group">
                                    <button type="button" onClick={handleCancelRename} disabled={isProcessingCategoryAction}>Cancel Rename</button>
                                    <button type="submit" disabled={ isProcessingCategoryAction || (!renameCategoryName.trim() && selectedColor === (optionsPopupCategory.color || '#FFFFFF')) || (renameCategoryName.trim() === optionsPopupCategory.name && selectedColor === (optionsPopupCategory.color || '#FFFFFF')) }>
                                        {isProcessingCategoryAction ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <form onSubmit={handleUpdateCategorySubmit}>
                                <div className="options-button-group">
                                    <button type="button" className="delete-button" onClick={() => handleDeleteCategory(optionsPopupCategory.id, optionsPopupCategory.name)} disabled={isProcessingCategoryAction}> Delete </button>
                                    <button type="button" onClick={handleTriggerRename} disabled={isProcessingCategoryAction}>Rename</button>
                                    <button type="submit" disabled={isProcessingCategoryAction || selectedColor === (optionsPopupCategory.color || '#FFFFFF')}>
                                        {isProcessingCategoryAction ? 'Saving...' : 'Save Color'}
                                    </button>
                                     <button type="button" onClick={handleCloseOptionsPopup} disabled={isProcessingCategoryAction}>Cancel</button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

export default DashboardPage;