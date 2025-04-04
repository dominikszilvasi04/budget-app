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
    // --- Existing State ---
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [goalName, setGoalName] = useState('');
    const [goalTargetAmount, setGoalTargetAmount] = useState('');
    const [goalTargetDate, setGoalTargetDate] = useState('');
    const [goalNotes, setGoalNotes] = useState('');
    const [isAddingGoal, setIsAddingGoal] = useState(false);
    const [addGoalError, setAddGoalError] = useState(null);
    const [addGoalSuccess, setAddGoalSuccess] = useState(null);

    // --- NEW State for Contribution Popup ---
    const [contributionPopupGoal, setContributionPopupGoal] = useState(null); // Goal object or null
    const [contributionAmount, setContributionAmount] = useState('');
    const [contributionNotes, setContributionNotes] = useState('');
    const [isAddingContribution, setIsAddingContribution] = useState(false);
    const [addContributionError, setAddContributionError] = useState(null);
    const [addContributionSuccess, setAddContributionSuccess] = useState(null);
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

    // --- NEW Contribution Popup Handlers ---
    const handleOpenContributionPopup = (goal) => {
        setContributionPopupGoal(goal); // Set the goal for the popup
        setContributionAmount(''); // Clear fields
        setContributionNotes('');
        setAddContributionError(null); // Clear previous status
        setAddContributionSuccess(null);
    };

    const handleCloseContributionPopup = () => {
        setContributionPopupGoal(null); // Close the popup
        // Don't clear fields here necessarily, maybe on open?
    };

    // --- NEW Add Contribution Submit Handler ---
    const handleAddContributionSubmit = async (event) => {
        event.preventDefault();
        if (!contributionPopupGoal) return; // Should not happen

        const parsedAmount = safeParseGoalFloat(contributionAmount); // Use goal parser (allows > 0)

        if (isNaN(parsedAmount)) {
            setAddContributionError("Valid positive contribution amount is required.");
            return;
        }

        setIsAddingContribution(true);
        setAddContributionError(null);
        setAddContributionSuccess(null);

        const payload = {
            amount: parsedAmount,
            notes: contributionNotes || null,
        };
        const goalId = contributionPopupGoal.id;

        try {
            const response = await axios.post(`http://localhost:5001/api/goals/${goalId}/contributions`, payload);

            // Update the specific goal in the local 'goals' state with the updated goal from the response
            setGoals(prevGoals => prevGoals.map(g =>
                g.id === goalId ? response.data.updatedGoal : g
            ));

            setAddContributionSuccess(`Contribution added to '${contributionPopupGoal.name}'!`);
            // Clear form inside popup
            setContributionAmount('');
            setContributionNotes('');

             // Close popup after delay
            setTimeout(() => {
                handleCloseContributionPopup();
            }, 1500);

        } catch (err) {
            console.error("Error adding contribution:", err);
            let message = "Failed to add contribution.";
            if (err.response?.data?.message) { message = err.response.data.message; }
            setAddContributionError(message);
            setAddContributionSuccess(null);
        } finally {
            setIsAddingContribution(false);
        }
    };


    // --- Render Logic ---
    if (loading) { return <div>Loading goals...</div>; }
    if (error) { return <div style={{ color: 'red', padding: '20px' }}>Error: {error}</div>; }

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
                                type="number"
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
                        <div className="goal-add-status-container" style={{marginLeft: '15px'}}>
                             {addGoalError && <span className="goal-add-status error">{addGoalError}</span>}
                             {addGoalSuccess && <span className="goal-add-status success">{addGoalSuccess}</span>}
                        </div>
                    </div>
                </form>
            </div>
            {/* --- End Add Goal Form --- */}


            {/* --- Display Goals List Section (Modified Card) --- */}
            <div className="goals-list-container">
                <h3>Current Goals</h3>
                {goals.length === 0 ? ( <p>You haven't added any savings goals yet.</p> ) : (
                    <div className="goals-list">
                        {goals.map(goal => {
                            // --- Calculate Progress ---
                            // Ensure target_amount is positive to avoid division by zero or weird percentages
                            const targetAmount = Math.max(0.01, goal.target_amount); // Treat 0 target as minimum 0.01
                            const currentAmount = Math.max(0, goal.current_amount); // Ensure current isn't negative
                            // Calculate percentage, cap at 100% visually even if over-saved
                            const percentage = Math.min(100, Math.max(0, (currentAmount / targetAmount) * 100));
                            const percentageString = percentage.toFixed(1) + '%'; // Format percentage string

                            return (
                                <div key={goal.id} className="goal-item-card">
                                    {/* Goal Name */}
                                    <h4>{goal.name}</h4>

                                    {/* Saved Amount & Percentage */}
                                    <div className="goal-progress-info">
                                        <span>Saved: {formatCurrency(currentAmount)} / {formatCurrency(targetAmount)}</span>
                                        <span>{percentageString}</span>
                                    </div>

                                    {/* --- NEW Progress Bar --- */}
                                    <div className="progress-bar-container">
                                        <div
                                            className="progress-bar-fill"
                                            // Apply width based on percentage
                                            style={{ width: percentageString }}
                                            title={percentageString} // Tooltip showing percentage
                                        ></div>
                                    </div>
                                    {/* --- End Progress Bar --- */}

                                    {/* Optional Target Date & Notes */}
                                    {goal.target_date && <p className="goal-target-date">Target Date: {goal.target_date}</p>}
                                    {goal.notes && <p className="goal-notes">Notes: {goal.notes}</p>}

                                    {/* Actions */}
                                    <div className="goal-card-actions">
                                        <button onClick={() => handleOpenContributionPopup(goal)} className="btn-add-contribution"> Add Contribution </button>
                                        {/* Edit/Delete buttons later */}
                                    </div>
                                </div> // End goal-item-card
                            );
                        })}
                    </div> // End goals-list
                )}
            </div> {/* End goals-list-container */}


            {/* --- Contribution Popup/Modal --- */}
            {/* Conditionally render based on contributionPopupGoal state */}
            {contributionPopupGoal && (
                <div className="popup-overlay contribution-overlay" onClick={handleCloseContributionPopup}>
                    {/* Stop propagation prevents closing when clicking inside */}
                    <div className="popup-content contribution-popup-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Add Contribution to: {contributionPopupGoal.name}</h3>
                        {/* Status Messages for Contribution */}
                         {addContributionError && <p className="options-error">{addContributionError}</p>} {/* Reuse error style */}
                         {addContributionSuccess && <p className="options-success">{addContributionSuccess}</p>} {/* Reuse success style */}

                        {/* Contribution Form */}
                        <form onSubmit={handleAddContributionSubmit} className="contribution-form">
                            <div className="form-group">
                                <label htmlFor="contribution-amount">Amount ($):</label>
                                <input
                                    type="number" // Use number type for better input control
                                    id="contribution-amount"
                                    value={contributionAmount}
                                    onChange={(e) => { setContributionAmount(e.target.value); if (addContributionError) setAddContributionError(null); }}
                                    step="0.01" min="0.01" placeholder="e.g., 50.00" required disabled={isAddingContribution} autoFocus
                                />
                            </div>
                             <div className="form-group">
                                <label htmlFor="contribution-notes">Notes (Optional):</label>
                                <textarea
                                    id="contribution-notes"
                                    value={contributionNotes}
                                    onChange={(e) => setContributionNotes(e.target.value)}
                                    rows="2" disabled={isAddingContribution}
                                ></textarea>
                             </div>
                             {/* Reusing options button group style for consistency */}
                             <div className="options-button-group">
                                 <button type="button" onClick={handleCloseContributionPopup} disabled={isAddingContribution}>Cancel</button>
                                 <button type="submit" disabled={isAddingContribution || !contributionAmount}>
                                     {isAddingContribution ? 'Adding...' : 'Add Contribution'}
                                 </button>
                             </div>
                        </form>
                    </div> {/* End popup-content */}
                </div> // End popup-overlay
            )}
            {/* --- End Contribution Popup --- */}


        </div> // End goals-page-container
    );
} // End of GoalsPage component needs to be outside this block

export default GoalsPage;