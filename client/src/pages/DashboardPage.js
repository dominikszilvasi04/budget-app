// client/src/pages/DashboardPage.js
import React, { useState, useEffect } from 'react'; // useMemo no longer needed here
import axios from 'axios';


function DashboardPage() {
    // --- State Variables ---
    // Category State
    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [errorCategories, setErrorCategories] = useState(null);

    // Form State - Now relates to the popup form
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
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
        setSubmitError(null);
        setSubmitSuccess(null);
        // No selectedCategoryId state to clear
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


    // --- Form Submission Handler (Modified) ---
    const handleTransactionSubmit = async (event) => {
        event.preventDefault();
        if (!selectedCategoryForPopup) {
            setSubmitError('No category selected.'); return;
        }

        // Modify Validation: Remove date check
        if (!amount || isNaN(parseFloat(amount))) {
            setSubmitError('Please enter a valid amount.');
            setSubmitSuccess(null);
            return;
        }

        // Generate current date HERE in 'YYYY-MM-DD' format
        const currentDate = new Date().toISOString().split('T')[0];

        const transactionData = {
            description: description || null,
            amount: parseFloat(amount),
            // Use the generated current date
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
        return <div>Loading dashboard data...</div>;
    }
    if (errorCategories && categories.length === 0) {
        return <div style={{ color: 'red', padding: '20px' }}>Error loading categories: {errorCategories}. Cannot display dashboard.</div>;
    }

    return (
        <>
            {/* Main layout now only contains the categories display */}
            <div className="main-layout-single-column">
                <section className="categories-display-section-full">
                    {/* ... Categories Grid JSX ... */}
                     <h2>Categories</h2>
                     {categories.length === 0 ? ( <p>No categories found.</p> ) : (
                         <div className="category-grid">
                             {categories.map(category => (
                                 <div key={category.id} className="category-select-box" onClick={() => handleCategoryBoxClick(category)}>
                                     <h3>{category.name}</h3>
                                 </div>
                             ))}
                         </div>
                     )}
                </section>
            </div>

            {/* --- Popup/Modal with Modified Form --- */}
            {selectedCategoryForPopup && (
                <div className="popup-overlay" onClick={handleClosePopup}>
                    <div className="popup-content" onClick={(e) => e.stopPropagation()}>
                        <h2>Add Transaction for: {selectedCategoryForPopup.name}</h2>
                        {submitError && <p style={{ color: 'red' }}>Error: {submitError}</p>}
                        {submitSuccess && <p style={{ color: 'green' }}>{submitSuccess}</p>}

                        {/* MODIFIED FORM LAYOUT */}
                        <form onSubmit={handleTransactionSubmit} className="popup-form">
                            {/* Amount Input (Moved to Top) */}
                            <div>
                                <label htmlFor="amount">Amount:</label>
                                {/* Added className="input-amount" */}
                                <input
                                    type="number"
                                    id="amount"
                                    className="input-amount"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    step="0.01" required disabled={isSubmitting} />
                            </div>

                            {/* Description Input (Moved Below Amount) */}
                            <div>
                                <label htmlFor="description">Description (Optional):</label>
                                {/* Added className="input-description" */}
                                <input
                                    type="text"
                                    id="description"
                                    className="input-description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Details..."
                                    disabled={isSubmitting} />
                            </div>

                            {/* DATE INPUT REMOVED */}
                            {/* <div> ... Date Input JSX Removed ... </div> */}

                            {/* Category Display (Remains the same) */}
                            <div className="form-category-display">
                                <label>Category:</label>
                                <span>{selectedCategoryForPopup.name}</span>
                            </div>

                            {/* Submit and Close Buttons (Remains the same) */}
                            <div className="popup-button-group">
                                <button type="button" onClick={handleClosePopup} className="popup-cancel-btn" disabled={isSubmitting}>Cancel</button>
                                <button type="submit" className="popup-submit-btn" disabled={isSubmitting}>
                                    {isSubmitting ? 'Adding...' : 'Add Transaction'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}

export default DashboardPage;