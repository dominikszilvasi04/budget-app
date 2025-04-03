// client/src/pages/DashboardPage.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

// --- Helper Functions ---
// Parses a string to float safely, returning NaN if invalid
const safeParseFloat = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return NaN;
    // Remove currency symbols, commas etc. before parsing if needed
    // const cleanedValue = value.replace(/[^0-9.-]+/g,""); // Example cleaning
    const parsed = parseFloat(value); // Use original value for now
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
    // Category State
    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [errorCategories, setErrorCategories] = useState(null);

    // Form State (for the popup form)
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState(''); // Amount stored as string
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [submitSuccess, setSubmitSuccess] = useState(null);

    // Popup State
    const [selectedCategoryForPopup, setSelectedCategoryForPopup] = useState(null); // Stores category object or null

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
    }, []); // Run once on component mount


    // --- Utility to clear form fields ---
    const clearFormFields = () => {
        setDescription('');
        setAmount(''); // Reset amount string
        setSubmitError(null);
        setSubmitSuccess(null);
    };

    // --- Popup Handlers ---
    const handleCategoryBoxClick = (category) => {
        setSelectedCategoryForPopup(category); // Store selected category
        clearFormFields(); // Clear form when opening
    };

    const handleClosePopup = () => {
        setSelectedCategoryForPopup(null); // Close popup
        clearFormFields(); // Also clear form on close
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

    // --- Form Submission Handler ---
    const handleTransactionSubmit = async (event) => {
        event.preventDefault(); // Prevent default form submission
        if (!selectedCategoryForPopup) {
            setSubmitError('No category selected.'); return;
        }

        const finalAmount = safeParseFloat(amount); // Parse final amount string from state
        if (isNaN(finalAmount)) { // Only check if it's a valid number
            setSubmitError('Please enter a valid amount.');
            setSubmitSuccess(null);
            return;
        }

        // Generate current date for submission
        const currentDate = new Date().toISOString().split('T')[0];

        const transactionData = {
            description: description || null,
            amount: finalAmount, // Use the parsed number
            transaction_date: currentDate,
            category_id: selectedCategoryForPopup.id, // Use ID from selected category object
        };

        setIsSubmitting(true);
        setSubmitError(null);
        setSubmitSuccess(null);

        try {
            const response = await axios.post('http://localhost:5001/api/transactions', transactionData);
            setSubmitSuccess(`Transaction for ${selectedCategoryForPopup.name} added!`);

            // Close popup after a delay
            setTimeout(() => {
                handleClosePopup();
                // Note: History page update relies on its own refetch mechanism now
            }, 1500);

        } catch (err) {
            console.error('Error submitting transaction:', err);
            let errorMessage = 'Failed to add transaction. Please try again.';
            if (err.response && err.response.data && err.response.data.message) {
                errorMessage = err.response.data.message;
            }
            setSubmitError(errorMessage);
            setSubmitSuccess(null);
        } finally {
            // Set submitting false after a short delay to allow state update/rerender
             setTimeout(() => setIsSubmitting(false), 500);
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
                    {categories.length === 0 ? (
                        <p>No categories defined yet.</p>
                    ) : (
                        <div className="category-grid">
                            {/* Map over categories to display selection boxes */}
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


            {/* --- Popup/Modal with Side Panel for Quick Add --- */}
            {/* Conditionally render the popup based on selectedCategoryForPopup state */}
            {selectedCategoryForPopup && (
                // Overlay covers the screen, closes popup on click
                <div className="popup-overlay" onClick={handleClosePopup}>

                    {/* Container for side-by-side panels - Stops propagation */}
                    <div className="popup-container" onClick={(e) => e.stopPropagation()}>

                        {/* Panel 1: Main Form Content */}
                        <div className="popup-content-main">
                            {/* Popup Title */}
                            <h2>Add Transaction for: {selectedCategoryForPopup.name}</h2>

                            {/* Display Submission Errors or Success Messages */}
                            {submitError && <p style={{ color: 'red', marginTop: '-10px', marginBottom: '15px' }}>Error: {submitError}</p>}
                            {submitSuccess && <p style={{ color: 'green', marginTop: '-10px', marginBottom: '15px' }}>{submitSuccess}</p>}

                            {/* Form */}
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
                                        disabled={isSubmitting}
                                        autoFocus
                                    />
                                    {/* Quick Add Buttons MOVED to side panel */}
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
                                        disabled={isSubmitting}
                                    />
                                </div>

                                {/* Category Display */}
                                <div className="form-category-display">
                                    <label>Category:</label>
                                    <span>{selectedCategoryForPopup.name}</span>
                                </div>

                                {/* Submit/Cancel Buttons */}
                                <div className="popup-button-group">
                                    <button type="button" onClick={handleClosePopup} className="popup-cancel-btn" disabled={isSubmitting}>Cancel</button>
                                    <button type="submit" className="popup-submit-btn" disabled={isSubmitting}>
                                        {isSubmitting ? 'Adding...' : 'Add Transaction'}
                                    </button>
                                </div>
                            </form> {/* End popup-form */}
                        </div> {/* End popup-content-main */}


                        {/* Panel 2: Quick Add Buttons */}
                        <div className="quick-add-panel">
                            <h4>Quick Add</h4>
                            {/* Buttons moved here */}
                            <div className="quick-add-buttons">
                                <button type="button" onClick={() => handleQuickAdd(1)} disabled={isSubmitting}>+1</button>
                                <button type="button" onClick={() => handleQuickAdd(5)} disabled={isSubmitting}>+5</button>
                                <button type="button" onClick={() => handleQuickAdd(10)} disabled={isSubmitting}>+10</button>
                                <button type="button" onClick={() => handleQuickAdd(20)} disabled={isSubmitting}>+20</button>
                                <button type="button" onClick={() => handleQuickAdd(-1)} disabled={isSubmitting}>-1</button>
                                <button type="button" onClick={() => handleQuickAdd(-5)} disabled={isSubmitting}>-5</button>
                                <button type="button" onClick={() => handleQuickAdd(-10)} disabled={isSubmitting}>-10</button>
                                <button type="button" onClick={() => handleQuickAdd(-20)} disabled={isSubmitting}>-20</button>
                                <button type="button" className="clear-button" onClick={() => setAmount('0.00')} disabled={isSubmitting}>Clear (0)</button>
                                <button type="button" onClick={() => setAmount(formatAmountForDisplay(5))} disabled={isSubmitting}>Set 5</button>
                                <button type="button" onClick={() => setAmount(formatAmountForDisplay(10))} disabled={isSubmitting}>Set 10</button>
                                <button type="button" onClick={() => setAmount(formatAmountForDisplay(20))} disabled={isSubmitting}>Set 20</button>
                            </div>
                        </div> {/* End quick-add-panel */}

                    </div> {/* End popup-container */}
                </div> // End popup-overlay
            )} {/* End conditional rendering of popup */}
        </> // End React Fragment
    );
} // End of DashboardPage component

export default DashboardPage; // Export the component