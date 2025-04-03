// client/src/pages/DashboardPage.js
import React, { useState, useEffect } from 'react'; // useMemo no longer needed here
import axios from 'axios';

// Keep parseFloat safe helper
const safeParseFloat = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return NaN;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? NaN : parsed;
};

// Keep formatting helper
const formatAmountForDisplay = (value) => {
    const num = safeParseFloat(value);
    if (isNaN(num)) {
        return ''; // Return empty string if not a valid number yet
    }
    // Format to 2 decimal places
    return num.toFixed(2);
};


function DashboardPage() {
     // --- State Variables ---
    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [errorCategories, setErrorCategories] = useState(null);
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState(''); // Keep as string
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [submitSuccess, setSubmitSuccess] = useState(null);
    const [selectedCategoryForPopup, setSelectedCategoryForPopup] = useState(null);

    // --- Fetch Categories Effect ---
    useEffect(() => {
        // Reset form state if categories reload unexpectedly? Optional.
        const fetchCategories = async () => {
            setLoadingCategories(true);
            setErrorCategories(null);
            try {
                const response = await axios.get('http://localhost:5001/api/categories');
                setCategories(response.data);
                // No need to set default form category here anymore
            } catch (err) {
                console.error("Error fetching categories:", err);
                setErrorCategories('Failed to load categories.');
            } finally {
                setLoadingCategories(false);
            }
        };
        fetchCategories();
    }, []);


    // --- Clears form fields ---
    const clearFormFields = () => {
        setDescription('');
        setAmount(''); // Reset amount string to empty
        setSubmitError(null);
        setSubmitSuccess(null);
    };

    // --- Popup Handlers ---
    const handleCategoryBoxClick = (category) => {
        setSelectedCategoryForPopup(category);
        clearFormFields();
    };
    const handleClosePopup = () => {
        setSelectedCategoryForPopup(null);
        clearFormFields();
    };

    // --- NEW: Amount Calculation Handler ---
    const handleAmountCalculation = (inputValue) => {
        // Get the current numerical value from state (or 0 if empty/invalid)
        const currentNumericAmount = safeParseFloat(amount) || 0;
        const trimmedInput = inputValue.trim();
        let newNumericAmount = currentNumericAmount;
        if (trimmedInput === '') {
            newNumericAmount = 0; // Clear if input is empty
        } else if (['+', '-', '*', '/'].includes(trimmedInput[0])) {
            const operator = trimmedInput[0];
            const valueStr = trimmedInput.substring(1);
            const operand = safeParseFloat(valueStr);

            if (!isNaN(operand)) { // Check if value after operator is a number
                switch (operator) {
                    case '+':
                        newNumericAmount = currentNumericAmount + operand;
                        break;
                    case '-':
                        newNumericAmount = currentNumericAmount - operand;
                        break;
                    case '*':
                        newNumericAmount = currentNumericAmount * operand;
                        break;
                    case '/':
                        if (operand !== 0) {
                            newNumericAmount = currentNumericAmount / operand;
                        } else {
                            // Handle division by zero - maybe show error or ignore
                            console.error("Division by zero attempted");
                            // Keep previous amount or set error state? For now, keep previous.
                            newNumericAmount = currentNumericAmount;
                        }
                        break;
                    default:
                        // Should not happen, but reset just in case
                        newNumericAmount = currentNumericAmount;
                }
            } else {
                 // Invalid input after operator, reset to current valid amount
                 newNumericAmount = currentNumericAmount;
            }
        } else {
            // Input doesn't start with operator, try parsing directly
            const directValue = safeParseFloat(trimmedInput);
            if (!isNaN(directValue)) {
                newNumericAmount = directValue;
            } else {
                 // Invalid number input, reset to current valid amount
                 newNumericAmount = currentNumericAmount;
            }
        }

        // Update state with the formatted STRING result
        setAmount(formatAmountForDisplay(newNumericAmount));
    };

    const handleQuickAdd = (addValue) => {
        // Get current numeric amount, default to 0
        const currentNumericAmount = safeParseFloat(amount) || 0;
        // Calculate new amount
        const newNumericAmount = currentNumericAmount + addValue;
        // Update state with formatted string result
        setAmount(formatAmountForDisplay(newNumericAmount));
    };


    // --- Form Submission Handler (Modified) ---
    const handleTransactionSubmit = async (event) => {
        event.preventDefault();
        if (!selectedCategoryForPopup) {
            setSubmitError('No category selected.'); return;
        }

        // Validate Amount based on the *parsed* state string
        const finalAmount = safeParseFloat(amount); // Parse the final state string
        if (isNaN(finalAmount) || finalAmount === 0) { // Also check for zero? Or allow zero? Let's allow zero for now.
             if (isNaN(finalAmount)) {
                setSubmitError('Please enter a valid amount.');
                setSubmitSuccess(null);
                return;
             }
        }

        const currentDate = new Date().toISOString().split('T')[0];
        const transactionData = {
            description: description || null,
            amount: finalAmount, // Use the parsed numerical amount
            transaction_date: currentDate,
            category_id: selectedCategoryForPopup.id,
        };

        setIsSubmitting(true);
        setSubmitError(null);
        setSubmitSuccess(null);

        try {
            const response = await axios.post('http://localhost:5001/api/transactions', transactionData);
            setSubmitSuccess(`Transaction for ${selectedCategoryForPopup.name} added!`);
            setTimeout(() => {
                // clearFormFields(); // Clear fields AFTER success message shows
                handleClosePopup(); // Close popup on success
            }, 1500);
        } catch (err) {
            // ... error handling ...
             console.error('Error submitting transaction:', err);
             let errorMessage = 'Failed to add transaction. Please try again.';
             if (err.response && err.response.data && err.response.data.message) {
                 errorMessage = err.response.data.message;
             }
             setSubmitError(errorMessage);
             setSubmitSuccess(null);
        } finally {
             // Set submitting false slightly after logic to prevent flickering
             setTimeout(() => setIsSubmitting(false), 500);
        }
    };


    // --- Render Logic ---
    if (loadingCategories) {
        // Simple loading state, could be replaced with a spinner component
        return <div>Loading dashboard data...</div>;
    }

    // Handle critical error fetching categories
    if (errorCategories && categories.length === 0) {
        return <div style={{ color: 'red', padding: '20px' }}>Error loading categories: {errorCategories}. Cannot display dashboard.</div>;
    }

    // Main return statement for the page content
    return (
        <> {/* Using React Fragment as the top-level wrapper */}
            {/* Main layout div - adjust class/styles if needed */}
            <div className="main-layout-single-column">
                {/* Categories Section */}
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

            {/* --- Popup/Modal for Adding Transaction with Quick Add Buttons --- */}
            {/* Conditionally render the popup based on selectedCategoryForPopup state */}
            {selectedCategoryForPopup && (
                // Overlay covers the screen, closes popup on click
                <div className="popup-overlay" onClick={handleClosePopup}>
                    {/* Popup content container, stops click propagation to overlay */}
                    <div className="popup-content" onClick={(e) => e.stopPropagation()}>
                        {/* Popup Title dynamically shows category name */}
                        <h2>Add Transaction for: {selectedCategoryForPopup.name}</h2>

                        {/* Display Submission Errors or Success Messages */}
                        {submitError && <p style={{ color: 'red', marginTop: '-10px', marginBottom: '15px' }}>Error: {submitError}</p>}
                        {submitSuccess && <p style={{ color: 'green', marginTop: '-10px', marginBottom: '15px' }}>{submitSuccess}</p>}

                        {/* Form moved inside the popup */}
                        <form onSubmit={handleTransactionSubmit} className="popup-form">

                             {/* --- Amount Input Group --- */}
                             <div className="amount-input-group"> {/* Wrapper for label, input, buttons */}
                                <label htmlFor="amount">Amount:</label>
                                <div className="amount-input-container"> {/* Container for input + buttons */}
                                    <input
                                        type="text" // Text input to allow operators
                                        inputMode="decimal" // Hint for numeric keyboard on mobile
                                        id="amount"
                                        className="input-amount" // Specific class for styling
                                        value={amount} // Controlled component using string state
                                        onChange={(e) => setAmount(e.target.value)} // Update state directly
                                        // Handle calculation logic on Enter key press
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault(); // Prevent default form submit on Enter here
                                                handleAmountCalculation(e.target.value); // Calculate the value
                                            }
                                        }}
                                        // Handle calculation logic when input loses focus
                                        onBlur={(e) => handleAmountCalculation(e.target.value)}
                                        placeholder="0.00 or +5, -10 etc." // Informative placeholder
                                        required // HTML5 validation
                                        disabled={isSubmitting} // Disable during submission
                                        autoFocus // Automatically focus this field when popup opens
                                    />
                                    {/* --- Quick Add Buttons --- */}
                                    <div className="quick-add-buttons">
                                        <button type="button" onClick={() => handleQuickAdd(1)} disabled={isSubmitting}>+1</button>
                                        <button type="button" onClick={() => handleQuickAdd(5)} disabled={isSubmitting}>+5</button>
                                        <button type="button" onClick={() => handleQuickAdd(10)} disabled={isSubmitting}>+10</button>
                                        <button type="button" onClick={() => handleQuickAdd(-1)} disabled={isSubmitting}>-1</button>
                                        <button type="button" onClick={() => handleQuickAdd(-5)} disabled={isSubmitting}>-5</button>
                                        {/* Add a clear button or more values if desired */}
                                         <button type="button" onClick={() => setAmount('0.00')} disabled={isSubmitting}>C</button>
                                    </div>
                                </div> {/* End amount-input-container */}
                            </div> {/* End amount-input-group */}


                            {/* Description Input */}
                            <div>
                                <label htmlFor="description">Description (Optional):</label>
                                <input
                                    type="text"
                                    id="description"
                                    className="input-description" // Specific class for styling
                                    value={description} // Controlled component
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Details..."
                                    disabled={isSubmitting} // Disable during submission
                                />
                            </div>

                            {/* Category Display (Read-only) */}
                            <div className="form-category-display">
                                <label>Category:</label>
                                <span>{selectedCategoryForPopup.name}</span>
                            </div>

                            {/* Button Group (Cancel and Submit) */}
                            <div className="popup-button-group">
                                <button
                                    type="button" // Important: type="button" prevents default form submission
                                    onClick={handleClosePopup}
                                    className="popup-cancel-btn"
                                    disabled={isSubmitting} // Disable during submission
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit" // This button submits the form
                                    className="popup-submit-btn"
                                    disabled={isSubmitting} // Disable during submission
                                >
                                    {isSubmitting ? 'Adding...' : 'Add Transaction'}
                                </button>
                            </div>
                        </form> {/* End of popup form */}
                    </div> {/* End popup-content */}
                </div> // End popup-overlay
            )} {/* End conditional rendering of popup */}
        </> // End React Fragment
    );
}

export default DashboardPage;