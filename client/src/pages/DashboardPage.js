// client/src/pages/DashboardPage.js
import React, { useState, useEffect } from 'react'; // useMemo no longer needed here
import axios from 'axios';

// Helper functions can stay if needed elsewhere, otherwise remove
const getTodayDate = () => { /* ... */ };
// const formatCurrency = (num) => { /* ... */ }; // Not used on this page anymore

function DashboardPage() {
    // --- State Variables ---
    // Category State
    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [errorCategories, setErrorCategories] = useState(null);

    // Form State - Now relates to the popup form
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [transactionDate, setTransactionDate] = useState(getTodayDate());
    // We don't need a separate state for the *form's* selected ID anymore
    // const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [submitSuccess, setSubmitSuccess] = useState(null); // For success message IN popup

    // Popup State
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
        setAmount('');
        setTransactionDate(getTodayDate());
        setSubmitError(null);
        setSubmitSuccess(null);
        // No selectedCategoryId state to clear
    };

    // --- Popup Handlers ---
    const handleCategoryBoxClick = (category) => {
        setSelectedCategoryForPopup(category); // Set the category for the popup
        clearFormFields(); // Clear fields when opening a new popup
    };

    const handleClosePopup = () => {
        setSelectedCategoryForPopup(null); // Close popup
        clearFormFields(); // Also clear fields on close
    };


    // --- Form Submission Handler (Modified for Popup) ---
    const handleTransactionSubmit = async (event) => {
        event.preventDefault();

        // Check if a category is selected (should always be true if form is visible)
        if (!selectedCategoryForPopup) {
            setSubmitError('No category selected. Please close and reopen the popup.');
            return;
        }

        // Basic validation
        if (!amount || isNaN(parseFloat(amount)) || !transactionDate) {
            setSubmitError('Please fill in amount and date.');
            setSubmitSuccess(null);
            return;
        }

        const transactionData = {
            description: description || null,
            amount: parseFloat(amount),
            transaction_date: transactionDate,
            // Get category_id directly from the category object stored in popup state
            category_id: selectedCategoryForPopup.id,
        };

        setIsSubmitting(true);
        setSubmitError(null);
        setSubmitSuccess(null);

        try {
            const response = await axios.post('http://localhost:5001/api/transactions', transactionData);

            // Show success message IN the popup briefly
            setSubmitSuccess(`Transaction for ${selectedCategoryForPopup.name} added!`);

            // Clear fields after a short delay, then close popup
            setTimeout(() => {
                clearFormFields();
                handleClosePopup(); // Close the popup automatically on success
                // NOTE: If the History page needs to update, we might need a global state
                // or callback mechanism here instead of relying on submitSuccess in this component.
            }, 1500); // Close after 1.5 seconds

        } catch (err) {
            console.error('Error submitting transaction:', err);
            let errorMessage = 'Failed to add transaction. Please try again.';
            if (err.response && err.response.data && err.response.data.message) {
                errorMessage = err.response.data.message;
            }
            setSubmitError(errorMessage); // Show error IN the popup
            setSubmitSuccess(null);
        } finally {
            // Still set submitting false after try/catch completes,
            // even though popup might close soon after.
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
        <>
            {/* Main layout now only contains the categories display */}
            <div className="main-layout-single-column"> {/* Renamed class? Or adjust main-layout */}
                {/* --- Categories Section --- */}
                <section className="categories-display-section-full"> {/* Renamed class? Or adjust categories-display-section */}
                    <h2>Categories</h2>
                    {categories.length === 0 ? (
                        <p>No categories found.</p>
                    ) : (
                        <div className="category-grid">
                            {categories.map(category => (
                                <div
                                    key={category.id}
                                    className="category-select-box"
                                    onClick={() => handleCategoryBoxClick(category)}
                                >
                                    <h3>{category.name}</h3>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div> {/* End main-layout-single-column */}

            {/* --- Popup/Modal with embedded Form --- */}
            {selectedCategoryForPopup && (
                <div className="popup-overlay" onClick={handleClosePopup}>
                    <div className="popup-content" onClick={(e) => e.stopPropagation()}>
                        {/* Pass category name to title */}
                        <h2>Add Transaction for: {selectedCategoryForPopup.name}</h2>

                        {/* Status Messages FOR THE FORM (inside popup) */}
                        {submitError && <p style={{ color: 'red' }}>Error: {submitError}</p>}
                        {submitSuccess && <p style={{ color: 'green' }}>{submitSuccess}</p>}

                        {/* The Form (moved inside popup) */}
                        <form onSubmit={handleTransactionSubmit} className="popup-form"> {/* Added class */}
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

                            {/* Category Display (replaces dropdown) */}
                            <div className="form-category-display">
                                <label>Category:</label>
                                <span>{selectedCategoryForPopup.name}</span>
                            </div>

                            {/* Submit and Close Buttons */}
                            <div className="popup-button-group">
                                <button type="button" onClick={handleClosePopup} className="popup-cancel-btn" disabled={isSubmitting}>Cancel</button>
                                <button type="submit" className="popup-submit-btn" disabled={isSubmitting}>
                                    {isSubmitting ? 'Adding...' : 'Add Transaction'}
                                </button>
                            </div>
                        </form>

                        {/* Original close button removed, handled by form buttons now */}
                        {/* <button onClick={handleClosePopup} className="popup-close-btn">Close</button> */}
                    </div>
                </div>
            )}
        </>
    );
}

export default DashboardPage;