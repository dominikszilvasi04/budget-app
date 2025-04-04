// client/src/pages/GoalsPage.js
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// Helpers (you might want a shared utils file eventually)
const formatCurrency = (num) => {
    const parsedNum = typeof num === 'number' ? num : parseFloat(num);
    if (isNaN(parsedNum)) { num = 0; } else { num = parsedNum; }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

// Specific parser for target amount (must be > 0)
const safeParseGoalFloat = (value) => {
    if (typeof value === 'number') return value > 0 ? value : NaN; // Must be positive
    if (typeof value !== 'string') return NaN;
    if (value.trim() === '') return NaN; // Don't treat empty as 0 here
    const cleanedValue = value.replace(/[\$,]/g, '').trim();
    if (cleanedValue === '') return NaN;
    const parsed = parseFloat(cleanedValue);
    return isNaN(parsed) || parsed <= 0 ? NaN : parsed; // Must be positive > 0
};


// --- Component Definition ---
function GoalsPage() {
    // --- State ---
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Add Goal Form State
    const [goalName, setGoalName] = useState('');
    const [goalTargetAmount, setGoalTargetAmount] = useState('');
    const [goalTargetDate, setGoalTargetDate] = useState('');
    const [goalNotes, setGoalNotes] = useState('');
    const [isAddingGoal, setIsAddingGoal] = useState(false);
    const [addGoalError, setAddGoalError] = useState(null);
    const [addGoalSuccess, setAddGoalSuccess] = useState(null);

    // --- Fetch Goals ---
    const fetchGoals = useCallback(async (controller) => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get('http://localhost:5001/api/goals', {
                signal: controller?.signal
            });
            setGoals(response.data); // Assuming backend sends sorted data or sort here if needed
        } catch (err) {
             if (!axios.isCancel(err)) {
                 console.error("Error fetching goals:", err);
                 setError('Failed to load goals.');
             }
        } finally {
            if (!controller?.signal?.aborted) {
                setLoading(false);
            }
        }
    }, []); // Empty dependency array for useCallback

    useEffect(() => {
        const controller = new AbortController();
        fetchGoals(controller);
        return () => controller.abort(); // Cleanup
    }, [fetchGoals]); // Depend on the fetch function


    // --- Add Goal Submit Handler ---
    const handleAddGoalSubmit = async (event) => {
        event.preventDefault();
        const trimmedName = goalName.trim();
        const parsedTarget = safeParseGoalFloat(goalTargetAmount); // Use goal-specific parser

        // Validation
        if (!trimmedName) { setAddGoalError("Goal name is required."); return; }
        if (isNaN(parsedTarget)) { setAddGoalError("Valid positive target amount is required."); return; }
        // Optional: Date validation can be added here

        setIsAddingGoal(true);
        setAddGoalError(null);
        setAddGoalSuccess(null);

        const payload = {
            name: trimmedName,
            target_amount: parsedTarget,
            target_date: goalTargetDate || null,
            notes: goalNotes || null,
        };

        try {
            const response = await axios.post('http://localhost:5001/api/goals', payload);
            setAddGoalError(null);
            // Add new goal to state and resort if needed (e.g., by name or creation date)
            setGoals(prevGoals =>
                [...prevGoals, response.data.newGoal].sort((a, b) => a.name.localeCompare(b.name)) // Example: sort by name
            );
            // Clear form
            setGoalName('');
            setGoalTargetAmount('');
            setGoalTargetDate('');
            setGoalNotes('');
            setAddGoalSuccess(`Goal '${response.data.newGoal.name}' added!`);
            setTimeout(() => setAddGoalSuccess(null), 3000);
        } catch (err) {
            console.error("Error adding goal:", err);
            let message = "Failed to add goal.";
            if (err.response?.data?.message) { message = err.response.data.message; }
            setAddGoalError(message);
            setAddGoalSuccess(null);
        } finally {
            setIsAddingGoal(false);
        }
    };


    // --- Render Logic ---
    if (loading) { return <div>Loading goals...</div>; }
    if (error) { return <div style={{ color: 'red', padding: '20px' }}>Error: {error}</div>; }

    // --- Main Return Statement ---
    return (
        <div className="goals-page-container"> {/* Use specific class */}
            <h2>Savings Goals</h2>

            {/* --- Add Goal Form Section --- */}
            <div className="add-goal-form-container">
                <h3>Add New Goal</h3>
                <form onSubmit={handleAddGoalSubmit} className="add-goal-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="goal-name">Goal Name:</label>
                            <input
                                type="text"
                                id="goal-name"
                                value={goalName}
                                onChange={(e) => { setGoalName(e.target.value); if (addGoalError) setAddGoalError(null); }}
                                maxLength="150" required disabled={isAddingGoal}
                             />
                        </div>
                        <div className="form-group">
                            <label htmlFor="goal-target-amount">Target Amount ($):</label>
                            <input
                                type="number" // Use number for easier input, but parse carefully
                                id="goal-target-amount"
                                value={goalTargetAmount}
                                onChange={(e) => { setGoalTargetAmount(e.target.value); if (addGoalError) setAddGoalError(null); }}
                                step="0.01" min="0.01" placeholder="e.g., 1000.00" required disabled={isAddingGoal}
                            />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="goal-target-date">Target Date (Optional):</label>
                            <input
                                type="date"
                                id="goal-target-date"
                                value={goalTargetDate}
                                onChange={(e) => setGoalTargetDate(e.target.value)}
                                disabled={isAddingGoal}
                            />
                        </div>
                    </div>
                     <div className="form-row">
                         <div className="form-group full-width">
                            <label htmlFor="goal-notes">Notes (Optional):</label>
                            <textarea
                                id="goal-notes"
                                value={goalNotes}
                                onChange={(e) => setGoalNotes(e.target.value)}
                                rows="2" disabled={isAddingGoal}
                            ></textarea>
                         </div>
                    </div>
                    <div className="form-row submit-row">
                        <button type="submit" disabled={isAddingGoal || !goalName.trim() || !goalTargetAmount}>
                            {isAddingGoal ? 'Adding...' : 'Add Goal'}
                        </button>
                        {/* Status Messages */}
                        <div className="goal-add-status-container" style={{marginLeft: '15px'}}> {/* Inline style for spacing */}
                             {addGoalError && <span className="goal-add-status error">{addGoalError}</span>}
                             {addGoalSuccess && <span className="goal-add-status success">{addGoalSuccess}</span>}
                        </div>
                    </div>
                </form>
            </div>
            {/* --- End Add Goal Form --- */}


            {/* --- Display Goals List Section --- */}
            <div className="goals-list-container">
                <h3>Current Goals</h3>
                {goals.length === 0 ? (
                    <p>You haven't added any savings goals yet.</p>
                ) : (
                    <div className="goals-list">
                        {goals.map(goal => (
                            <div key={goal.id} className="goal-item-card">
                                <h4>{goal.name}</h4>
                                <p>Target: {formatCurrency(goal.target_amount)}</p>
                                {/* Display current amount and progress bar in later phase */}
                                <p>Saved: {formatCurrency(goal.current_amount)} (0%)</p> {/* Placeholder % */}
                                {goal.target_date && <p>Target Date: {goal.target_date}</p>}
                                {goal.notes && <p className="goal-notes">Notes: {goal.notes}</p>}
                                {/* Add Contribution / Edit / Delete buttons later */}
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {/* --- End Display Goals --- */}
        </div> // End goals-page-container
    );
} // End of GoalsPage component

export default GoalsPage; // Export the component