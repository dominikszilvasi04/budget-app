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


// --- Component Definition ---
function DashboardPage() {
    // --- State Variables ---
    // Categories
    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [errorCategories, setErrorCategories] = useState(null);

    // Popup Transaction Form State
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState(''); // Amount stored as string
    const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false); // Renamed for clarity
    const [submitTransactionError, setSubmitTransactionError] = useState(null);   // Renamed for clarity
    const [submitTransactionSuccess, setSubmitTransactionSuccess] = useState(null); // Renamed for clarity

    // Popup Control State
    const [selectedCategoryForPopup, setSelectedCategoryForPopup] = useState(null); // Stores category object or null

    // Add Category Form State
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [addCategoryError, setAddCategoryError] = useState(null);
    const [addCategorySuccess, setAddCategorySuccess] = useState(null);


    // --- Fetch Categories Effect ---
    useEffect(() => {
        const fetchCategories = async () => {
            setLoadingCategories(true);
            setErrorCategories(null);
            try {
                const response = await axios.get('http://localhost:5001/api/categories');
                // Sort categories alphabetically when fetched
                setCategories(response.data.sort((a, b) => a.name.localeCompare(b.name)));
            } catch (err) {
                console.error("Error fetching categories:", err);
                setErrorCategories('Failed to load categories.');
            } finally {
                setLoadingCategories(false);
            }
        };
        fetchCategories();
    }, []); // Run once on component mount


    // --- Utility to clear Transaction form fields ---
    const clearTransactionFormFields = () => {
        setDescription('');
        setAmount('');
        setSubmitTransactionError(null); // Use renamed state
        setSubmitTransactionSuccess(null); // Use renamed state
    };

    // --- Popup Handlers ---
    const handleCategoryBoxClick = (category) => {
        setSelectedCategoryForPopup(category); // Store selected category
        clearTransactionFormFields(); // Clear transaction form when opening
    };

    const handleClosePopup = () => {
        setSelectedCategoryForPopup(null); // Close popup
        clearTransactionFormFields(); // Also clear transaction form on close
    };

    // --- Amount Input Calculation Handler (for Enter/Blur) ---
    const handleAmountCalculation = (inputValue) => {
        const currentNumericAmount = safeParseFloat(amount) || 0;
        const trimmedInput = inputValue.trim();
        let newNumericAmount = currentNumericAmount;

        if (trimmedInput === '') {
            newNumericAmount = 0;
        } else if (['+', '-', '*', '/'].includes(trimmedInput[0])) {
            const operator = trimmedInput[0];
            const valueStr = trimmedInput.substring(1);
            const operand = safeParseFloat(valueStr);

            if (!isNaN(operand)) {
                switch (operator) {
                    case '+': newNumericAmount = currentNumericAmount + operand; break;
                    case '-': newNumericAmount = currentNumericAmount - operand; break;
                    case '*': newNumericAmount = currentNumericAmount * operand; break;
                    case '/':
                        if (operand !== 0) {
                            newNumericAmount = currentNumericAmount / operand;
                        } else {
                            console.error("Division by zero attempted");
                            newNumericAmount = currentNumericAmount; // Keep previous value on error
                        }
                        break;
                    default: newNumericAmount = currentNumericAmount;
                }
            } else { newNumericAmount = currentNumericAmount; } // Invalid operand
        } else {
            const directValue = safeParseFloat(trimmedInput);
            if (!isNaN(directValue)) {
                newNumericAmount = directValue;
            } else { newNumericAmount = currentNumericAmount; } // Invalid direct number
        }
        setAmount(formatAmountForDisplay(newNumericAmount)); // Update state with formatted string
    };

    // --- Quick Add Button Handler ---
    const handleQuickAdd = (addValue) => {
        const currentNumericAmount = safeParseFloat(amount) || 0;
        const newNumericAmount = currentNumericAmount + addValue;
        setAmount(formatAmountForDisplay(newNumericAmount)); // Update state with formatted string
    };

    // --- Transaction Form Submission Handler ---
    const handleTransactionSubmit = async (event) => {
        event.preventDefault();
        if (!selectedCategoryForPopup) {
            setSubmitTransactionError('No category selected.'); return;
        }

        const finalAmount = safeParseFloat(amount);
        if (isNaN(finalAmount)) {
            setSubmitTransactionError('Please enter a valid amount.');
            setSubmitTransactionSuccess(null);
            return;
        }

        const currentDate = new Date().toISOString().split('T')[0];
        const transactionData = {
            description: description || null,
            amount: finalAmount,
            transaction_date: currentDate,
            category_id: selectedCategoryForPopup.id,
        };

        setIsSubmittingTransaction(true);
        setSubmitTransactionError(null);
        setSubmitTransactionSuccess(null);

        try {
            const response = await axios.post('http://localhost:5001/api/transactions', transactionData);
            setSubmitTransactionSuccess(`Transaction for ${selectedCategoryForPopup.name} added!`);

            setTimeout(() => {
                handleClosePopup();
                // Note: History page update relies on its own refetch mechanism
            }, 1500);

        } catch (err) {
            console.error('Error submitting transaction:', err);
            let errorMessage = 'Failed to add transaction. Please try again.';
            if (err.response && err.response.data && err.response.data.message) {
                errorMessage = err.response.data.message;
            }
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

        if (!trimmedName) {
            setAddCategoryError("Category name cannot be empty.");
            return;
        }

        setIsAddingCategory(true);
        setAddCategoryError(null);
        setAddCategorySuccess(null);

        try {
            const response = await axios.post('http://localhost:5001/api/categories', { name: trimmedName });

            // Add new category and resort the list
            setCategories(prevCategories =>
                [...prevCategories, response.data.newCategory].sort((a, b) =>
                    a.name.localeCompare(b.name)
                 )
            );

            setNewCategoryName(''); // Clear input
            setAddCategorySuccess(`Category '${response.data.newCategory.name}' added!`);
            setTimeout(() => setAddCategorySuccess(null), 3000); // Clear success message

        } catch (err) {
            console.error("Error adding category:", err);
            let message = "Failed to add category.";
            if (err.response && err.response.data && err.response.data.message) {
                message = err.response.data.message; // Show specific error from backend
            }
            setAddCategoryError(message);
            setAddCategorySuccess(null);
        } finally {
            setIsAddingCategory(false);
        }
    };


    // --- Render Logic ---
    if (loadingCategories) {
        return <div>Loading dashboard data...</div>;
    }
    if (errorCategories && categories.length === 0) {
        return <div style={{ color: 'red', padding: '20px' }}>Error loading categories: {errorCategories}. Cannot display dashboard.</div>;
    }

    return (
        <> {/* React Fragment */}
            <div className="main-layout-single-column">
                <section className="categories-display-section-full">
                    <h2>Categories</h2>

                    {/* Add Category Form */}
                    <form onSubmit={handleAddCategorySubmit} className="add-category-form">
                        <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="New category name..."
                            disabled={isAddingCategory}
                            maxLength="100"
                        />
                        <button type="submit" disabled={isAddingCategory || !newCategoryName.trim()}>
                            {isAddingCategory ? 'Adding...' : 'Add Category'}
                        </button>
                        {/* Display Add Category Status */}
                        {addCategoryError && <span className="category-add-status error">{addCategoryError}</span>}
                        {addCategorySuccess && <span className="category-add-status success">{addCategorySuccess}</span>}
                    </form>

                    {/* Category Grid */}
                    {categories.length === 0 && !loadingCategories ? (
                        <p>No categories defined yet. Add one above!</p>
                    ) : (
                        <div className="category-grid">
                            {categories.map(category => (
                                <div
                                    key={category.id}
                                    className="category-select-box"
                                    onClick={() => handleCategoryBoxClick(category)} // Open popup on click
                                >
                                    <h3>{category.name}</h3>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div> {/* End main-layout-single-column */}


            {/* --- Popup/Modal for Adding Transaction with Side Panel --- */}
            {selectedCategoryForPopup && (
                <div className="popup-overlay" onClick={handleClosePopup}>
                    {/* Container stops propagation */}
                    <div className="popup-container" onClick={(e) => e.stopPropagation()}>

                        {/* Panel 1: Main Form Content */}
                        <div className="popup-content-main">
                            <h2>Add Transaction for: {selectedCategoryForPopup.name}</h2>
                            {submitTransactionError && <p style={{ color: 'red', marginTop: '-10px', marginBottom: '15px' }}>Error: {submitTransactionError}</p>}
                            {submitTransactionSuccess && <p style={{ color: 'green', marginTop: '-10px', marginBottom: '15px' }}>{submitTransactionSuccess}</p>}

                            <form onSubmit={handleTransactionSubmit} className="popup-form">
                                {/* Amount Input */}
                                <div>
                                    <label htmlFor="amount">Amount:</label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        id="amount"
                                        className="input-amount"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAmountCalculation(e.target.value); }}}
                                        onBlur={(e) => handleAmountCalculation(e.target.value)}
                                        placeholder="0.00 or +5, -10 etc."
                                        required
                                        disabled={isSubmittingTransaction}
                                        autoFocus
                                    />
                                </div>

                                {/* Description Input */}
                                <div>
                                    <label htmlFor="description">Description (Optional):</label>
                                    <input
                                        type="text"
                                        id="description"
                                        className="input-description"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Details..."
                                        disabled={isSubmittingTransaction}
                                    />
                                </div>

                                {/* Category Display */}
                                <div className="form-category-display">
                                    <label>Category:</label>
                                    <span>{selectedCategoryForPopup.name}</span>
                                </div>

                                {/* Submit/Cancel Buttons */}
                                <div className="popup-button-group">
                                    <button type="button" onClick={handleClosePopup} className="popup-cancel-btn" disabled={isSubmittingTransaction}>Cancel</button>
                                    <button type="submit" className="popup-submit-btn" disabled={isSubmittingTransaction}>
                                        {isSubmittingTransaction ? 'Adding...' : 'Add Transaction'}
                                    </button>
                                </div>
                            </form> {/* End popup-form */}
                        </div> {/* End popup-content-main */}


                        {/* Panel 2: Quick Add Buttons */}
                        <div className="quick-add-panel">
                            <h4>Quick Add</h4>
                            {/* Main grid for +/- and Set buttons */}
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

                            {/* Clear Button (Positioned Separately via CSS) */}
                            <div className="quick-add-clear-container">
                                <button
                                    type="button"
                                    className="clear-button"
                                    onClick={() => setAmount('0.00')}
                                    disabled={isSubmittingTransaction}
                                >
                                    Clear (0)
                                </button>
                            </div>
                        </div> {/* End quick-add-panel */}

                    </div> {/* End popup-container */}
                </div> // End popup-overlay
            )} {/* End conditional rendering of popup */}
        </> // End React Fragment
    );
} // End of DashboardPage component

export default DashboardPage; // Export the component