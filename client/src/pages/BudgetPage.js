// client/src/pages/BudgetPage.js
import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import axios from 'axios';

// Add helper if needed, or ensure it's globally available
const formatCurrency = (num) => {
    // Handle null/undefined/non-numbers gracefully
    const parsedNum = parseFloat(num);
    if (isNaN(parsedNum)) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0);
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parsedNum);
};

// Helper to safely parse input for budget amount
const safeParseBudgetFloat = (value) => {
     if (typeof value === 'number') return value;
     if (typeof value !== 'string') return NaN;
     // Allow empty string to represent clearing the budget (or setting to 0)
     if (value.trim() === '') return 0.00; // Treat empty as 0
     // Basic cleaning - remove common currency symbols, commas, maybe spaces?
     const cleanedValue = value.replace(/[\$,]/g, '').trim();
     if (cleanedValue === '') return 0.00;
     const parsed = parseFloat(cleanedValue);
     // Ensure it's not negative for budget
     return isNaN(parsed) || parsed < 0 ? NaN : parsed;
};


function BudgetPage() {
    // State for budget data (array of {id, name, budget_amount})
    const [budgetData, setBudgetData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // State to track saving status for individual items (optional but good UX)
    const [savingStatus, setSavingStatus] = useState({}); // e.g., { categoryId: 'saving' | 'saved' | 'error', message: '' }

    // --- Fetch Budget Data ---
    const fetchBudgetData = useCallback(async (controller) => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get('http://localhost:5001/api/budgets/current', {
                signal: controller?.signal // Use optional chaining for signal
            });
            // Initialize budget_amount to 0.00 if it's null from backend
            const initializedData = response.data.map(item => ({
                 ...item,
                 budget_amount: item.budget_amount === null ? 0.00 : item.budget_amount
            }));
            setBudgetData(initializedData);
        } catch (err) {
            if (!axios.isCancel(err)) {
                console.error("Error fetching budget data:", err);
                setError('Failed to load budget data.');
            }
        } finally {
            // Check signal if controller was passed
            if (!controller?.signal?.aborted) {
                setLoading(false);
            }
        }
    }, []); // useCallback dependency array is empty

    useEffect(() => {
        const controller = new AbortController();
        fetchBudgetData(controller);
        // Cleanup function
        return () => {
            controller.abort();
        };
    }, [fetchBudgetData]); // Depend on the memoized fetch function


    // --- Handle Input Change (Update local state immediately) ---
    const handleBudgetChange = (categoryId, value) => {
        // Update the local state first for immediate feedback
        setBudgetData(currentData =>
            currentData.map(item =>
                item.id === categoryId ? { ...item, budget_amount_input: value } : item
                // Use a temporary 'budget_amount_input' field to store raw input
            )
        );
        // Clear saving status for this item when user types again
        if (savingStatus[categoryId]) {
            setSavingStatus(prev => ({ ...prev, [categoryId]: null }));
        }
    };


    // --- Handle Saving Budget (onBlur) ---
    const handleBudgetSave = async (categoryId) => {
        const budgetItem = budgetData.find(item => item.id === categoryId);
        if (!budgetItem) return; // Should not happen

        // Use the temporary input value if it exists, otherwise the stored amount
        const valueToSave = budgetItem.budget_amount_input !== undefined
            ? budgetItem.budget_amount_input
            : budgetItem.budget_amount;

        // Validate and parse the input value
        const parsedAmount = safeParseBudgetFloat(valueToSave);

        if (isNaN(parsedAmount)) {
            // Invalid input, potentially revert or show error
             console.error("Invalid budget amount entered:", valueToSave);
             setSavingStatus(prev => ({ ...prev, [categoryId]: { status: 'error', message: 'Invalid number' } }));
             // Optionally revert the input field after a delay
             setTimeout(() => {
                 setBudgetData(currentData =>
                     currentData.map(item =>
                         item.id === categoryId ? { ...item, budget_amount_input: item.budget_amount.toFixed(2) } : item
                     )
                 );
                  setSavingStatus(prev => ({ ...prev, [categoryId]: null }));
             }, 2000);
             return;
        }

        // Check if the parsed amount is different from the currently stored *numeric* amount
        const storedAmount = budgetItem.budget_amount;
        if (parsedAmount === storedAmount) {
            // No change, just clear the temporary input state if it exists
             setBudgetData(currentData =>
                 currentData.map(item =>
                     item.id === categoryId ? { ...item, budget_amount_input: undefined } : item
                 )
             );
            console.log(`No change for category ${categoryId}`);
            return; // Exit if no actual change
        }


        // Update saving status
        setSavingStatus(prev => ({ ...prev, [categoryId]: { status: 'saving' } }));

        try {
            // Call the backend API
            const response = await axios.put('http://localhost:5001/api/budgets/set', {
                categoryId: categoryId,
                amount: parsedAmount // Send the parsed numeric value
            });

            // Update the main budget_amount in state with the saved value
            // and clear the temporary input state
            setBudgetData(currentData =>
                currentData.map(item =>
                    item.id === categoryId
                        ? { ...item, budget_amount: response.data.budget.budget_amount, budget_amount_input: undefined }
                        : item
                )
            );

            // Update status to 'saved' briefly
            setSavingStatus(prev => ({ ...prev, [categoryId]: { status: 'saved' } }));
            setTimeout(() => setSavingStatus(prev => ({ ...prev, [categoryId]: null })), 2000); // Clear status after 2s

        } catch (err) {
            console.error("Error saving budget:", err);
            let message = "Save failed";
            if (err.response?.data?.message) message = err.response.data.message;
            // Update status to 'error'
            setSavingStatus(prev => ({ ...prev, [categoryId]: { status: 'error', message } }));
             // Optionally revert the input field after a delay on error
             setTimeout(() => {
                 setBudgetData(currentData =>
                     currentData.map(item =>
                         item.id === categoryId ? { ...item, budget_amount_input: item.budget_amount.toFixed(2) } : item
                     )
                 );
                 // Maybe don't clear error status immediately? Let user see it.
                 // setTimeout(() => setSavingStatus(prev => ({ ...prev, [categoryId]: null })), 5000);
             }, 2000);
        }
    };


    // --- Render Logic ---
    if (loading) {
        return <div>Loading budget data...</div>;
    }
    if (error) {
        return <div style={{ color: 'red', padding: '20px' }}>Error: {error}</div>;
    }

    return (
        <div className="budget-page-container">
            <h2>Monthly Budget Allocation</h2>
            <p>Enter the budget amount for each category for the current month. Changes save automatically when you click away.</p>

            <div className="budget-list">
                {budgetData.length === 0 ? (
                    <p>No categories found. Add categories on the Dashboard first.</p>
                ) : (
                    budgetData.map((item) => (
                        <div key={item.id} className="budget-item">
                            <label htmlFor={`budget-${item.id}`} className="budget-item-label">
                                {item.name}
                            </label>
                            <div className="budget-item-input-group">
                                <span className="currency-symbol">$</span> {/* Or your currency */}
                                <input
                                    type="text" // Use text to allow flexible input
                                    inputMode="decimal" // Hint for keyboard
                                    id={`budget-${item.id}`}
                                    className="budget-item-input"
                                    // Display temporary input value if it exists, otherwise formatted stored value
                                    value={item.budget_amount_input !== undefined ? item.budget_amount_input : item.budget_amount.toFixed(2)}
                                    onChange={(e) => handleBudgetChange(item.id, e.target.value)}
                                    onBlur={() => handleBudgetSave(item.id)} // Save on blur
                                    placeholder="0.00"
                                />
                                {/* Display Saving Status */}
                                <span className={`budget-item-status status-${savingStatus[item.id]?.status}`}>
                                    {savingStatus[item.id]?.status === 'saving' && 'Saving...'}
                                    {savingStatus[item.id]?.status === 'saved' && 'Saved!'}
                                    {savingStatus[item.id]?.status === 'error' && `Error: ${savingStatus[item.id]?.message || 'Failed'}`}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default BudgetPage;