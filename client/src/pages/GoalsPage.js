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

    // --- NEW State for Goal Options Popup ---
    const [optionsPopupGoal, setOptionsPopupGoal] = useState(null); // The goal object for which options are shown
    const [isGoalRenameMode, setIsGoalRenameMode] = useState(false); // Toggles rename form visibility
    // State for rename form inputs - initialize when popup opens
    const [renameGoalNameInput, setRenameGoalNameInput] = useState('');
    const [renameTargetAmountInput, setRenameTargetAmountInput] = useState('');
    const [renameTargetDateInput, setRenameTargetDateInput] = useState('');
    const [renameNotesInput, setRenameNotesInput] = useState('');
    // Loading/Error state specifically for goal update/delete actions
    const [isProcessingGoalAction, setIsProcessingGoalAction] = useState(false);
    const [goalActionError, setGoalActionError] = useState(null);


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


    // --- NEW Handlers for Goal Options Popup ---
    const handleGoalOptionsIconClick = (event, goal) => {
        event.stopPropagation(); // Prevent card click action
        setOptionsPopupGoal(goal); // Set the goal for the options popup
        // Pre-fill rename form state with current goal data
        setRenameGoalNameInput(goal.name);
        setRenameTargetAmountInput(goal.target_amount.toFixed(2)); // Format for input type=number
        setRenameTargetDateInput(goal.target_date || ''); // Use empty string if null
        setRenameNotesInput(goal.notes || ''); // Use empty string if null
        // Reset popup state
        setIsGoalRenameMode(false); // Start in default view
        setGoalActionError(null); // Clear previous errors
    };

    const handleCloseGoalOptionsPopup = () => {
        setOptionsPopupGoal(null); // Close the popup
        // Clear rename state just in case
        setIsGoalRenameMode(false);
        setGoalActionError(null);
        // No need to clear rename inputs here, they get set on open
    };

    const handleTriggerGoalRename = () => {
        setIsGoalRenameMode(true); // Switch view within the popup
        setGoalActionError(null); // Clear errors
    };

    const handleCancelGoalRename = () => {
        setIsGoalRenameMode(false); // Switch view back
        // No need to reset inputs here, they'll reset if popup is reopened
        setGoalActionError(null); // Clear errors
    };

    // --- NEW Update Goal Submit Handler ---
    const handleUpdateGoalSubmit = async (event) => {
        event.preventDefault();
        if (!optionsPopupGoal) return;

        const goalId = optionsPopupGoal.id;
        const originalGoal = optionsPopupGoal;

        // Prepare payload with potentially changed values
        const payload = {};
        let changed = false;

        // Name
        const newNameTrimmed = renameGoalNameInput.trim();
        if (newNameTrimmed && newNameTrimmed !== originalGoal.name) {
            if (newNameTrimmed.length > 150) { setGoalActionError('Name max 150 chars.'); return; }
            payload.name = newNameTrimmed;
            changed = true;
        } else if (!newNameTrimmed && isGoalRenameMode) { // Check if empty only in rename mode
            setGoalActionError('Goal name is required.'); return;
        }

        // Target Amount
        const parsedTarget = safeParseGoalFloat(renameTargetAmountInput);
         // Use !== comparison because 0 is falsy but could be a valid (though disallowed by safeParseGoalFloat) input attempt
        if (renameTargetAmountInput !== '' && isNaN(parsedTarget)) {
             setGoalActionError('Valid positive target amount required.'); return;
        }
        if (!isNaN(parsedTarget) && parsedTarget !== originalGoal.target_amount) {
            payload.target_amount = parsedTarget;
            changed = true;
        }

         // Target Date
        const newDate = renameTargetDateInput || null; // Treat empty string as null
        if (newDate !== originalGoal.target_date) {
             // Optional: add date format validation here if needed before sending
            payload.target_date = newDate;
            changed = true;
        }

        // Notes
         const newNotes = renameNotesInput.trim() || null; // Treat empty string as null
        if (newNotes !== (originalGoal.notes || null)) { // Compare with null if original notes were null
            payload.notes = newNotes;
            changed = true;
        }

        // If nothing actually changed, just close
        if (!changed) {
            handleCloseGoalOptionsPopup();
            return;
        }

        setIsProcessingGoalAction(true);
        setGoalActionError(null);

        try {
            const response = await axios.put(`http://localhost:5001/api/goals/${goalId}`, payload);

            // Update the goal in the main list state
            setGoals(prevGoals => prevGoals.map(g =>
                g.id === goalId ? response.data.updatedGoal : g
             ).sort((a, b) => a.name.localeCompare(b.name))); // Keep sorted

            handleCloseGoalOptionsPopup(); // Close on success

        } catch (err) {
            console.error("Error updating goal:", err);
            let message = "Failed to update goal.";
            if (err.response?.data?.message) { message = err.response.data.message; }
            setGoalActionError(message);
        } finally {
             setIsProcessingGoalAction(false);
        }
    };


    // --- NEW Delete Goal Handler ---
    const handleDeleteGoal = async (goalId, goalName) => {
        if (!window.confirm(`Are you sure you want to delete the goal "${goalName}"? All contributions will also be deleted.`)) {
             return;
        }

        setIsProcessingGoalAction(true);
        setGoalActionError(null);

        try {
            await axios.delete(`http://localhost:5001/api/goals/${goalId}`);
            // Remove goal from state
            setGoals(prevGoals => prevGoals.filter(g => g.id !== goalId));
            handleCloseGoalOptionsPopup(); // Close on success
        } catch (err) {
             console.error("Error deleting goal:", err);
             let message = "Failed to delete goal.";
             if (err.response?.data?.message) { message = err.response.data.message; }
             setGoalActionError(message); // Show error in popup
        } finally {
             setIsProcessingGoalAction(false);
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


            {/* Display Goals List Section */}
            <div className="goals-list-container">
                <h3>Current Goals</h3>
                {goals.length === 0 && !loading ? ( <p>You haven't added any savings goals yet.</p> ) : (
                    <div className="goals-list">
                        {goals.map(goal => {
                            // Calculate progress for display
                            const targetAmount = Math.max(0.01, goal.target_amount);
                            const currentAmount = Math.max(0, goal.current_amount);
                            const percentage = Math.min(100, Math.max(0, (currentAmount / targetAmount) * 100));
                            const percentageString = percentage.toFixed(1) + '%';

                            return (
                                <div key={goal.id} className="goal-item-card">
                                    {/* --- Goal Options Button --- */}
                                    <button
                                        className="goal-options-btn" // Use a specific class
                                        onClick={(e) => handleGoalOptionsIconClick(e, goal)}
                                        title="Goal Options"
                                        disabled={isProcessingGoalAction && optionsPopupGoal?.id === goal.id}
                                    >
                                        ⚙️
                                    </button>
                                    {/* --- End Options Button --- */}

                                    <h4>{goal.name}</h4>
                                    <div className="goal-progress-info">
                                        <span>Saved: {formatCurrency(currentAmount)} / {formatCurrency(targetAmount)}</span>
                                        <span>{percentageString}</span>
                                    </div>
                                    <div className="progress-bar-container">
                                        <div className="progress-bar-fill" style={{ width: percentageString }} title={percentageString}></div>
                                    </div>
                                    {goal.target_date && <p className="goal-target-date">Target Date: {goal.target_date}</p>}
                                    {goal.notes && <p className="goal-notes">Notes: {goal.notes}</p>}
                                    <div className="goal-card-actions">
                                        <button onClick={() => handleOpenContributionPopup(goal)} className="btn-add-contribution"> Add Contribution </button>
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

            {/* --- NEW: Goal Options Popup/Modal --- */}
        {optionsPopupGoal && (
             <div className="popup-overlay options-overlay" onClick={handleCloseGoalOptionsPopup}>
                 <div className="options-popup-content" onClick={(e) => e.stopPropagation()}>
                     <h3>Options for: {optionsPopupGoal.name}</h3>
                     {goalActionError && <p className="options-error">{goalActionError}</p>}

                     {/* Conditionally Render Rename Form or Default Buttons */}
                     {isGoalRenameMode ? (
                        // Rename Form
                         <form onSubmit={handleUpdateGoalSubmit} className="rename-form goal-rename-form"> {/* Added specific class */}
                            <div className="form-group">
                                 <label htmlFor="rename-goal-name">Goal Name:</label>
                                 <input id="rename-goal-name" type="text" value={renameGoalNameInput} onChange={(e) => { setRenameGoalNameInput(e.target.value); if (goalActionError) setGoalActionError(null); }} disabled={isProcessingGoalAction} maxLength="150" required autoFocus />
                            </div>
                            <div className="form-group">
                                 <label htmlFor="rename-goal-target-amount">Target Amount ($):</label>
                                 <input id="rename-goal-target-amount" type="number" value={renameTargetAmountInput} onChange={(e) => { setRenameTargetAmountInput(e.target.value); if (goalActionError) setGoalActionError(null); }} disabled={isProcessingGoalAction} step="0.01" min="0.01" required />
                             </div>
                             <div className="form-group">
                                 <label htmlFor="rename-goal-target-date">Target Date (Optional):</label>
                                 <input id="rename-goal-target-date" type="date" value={renameTargetDateInput} onChange={(e) => { setRenameTargetDateInput(e.target.value); if (goalActionError) setGoalActionError(null); }} disabled={isProcessingGoalAction} />
                             </div>
                             <div className="form-group">
                                 <label htmlFor="rename-goal-notes">Notes (Optional):</label>
                                 <textarea id="rename-goal-notes" value={renameNotesInput} onChange={(e) => { setRenameNotesInput(e.target.value); if (goalActionError) setGoalActionError(null); }} rows="2" disabled={isProcessingGoalAction}></textarea>
                             </div>
                             {/* Rename Buttons */}
                             <div className="options-button-group">
                                 <button type="button" onClick={handleCancelGoalRename} disabled={isProcessingGoalAction}>Cancel</button>
                                 <button type="submit" disabled={isProcessingGoalAction /* Add more precise check later */}>
                                     {isProcessingGoalAction ? 'Saving...' : 'Save Changes'}
                                 </button>
                             </div>
                         </form>
                     ) : (
                        // Default Options Buttons
                         <div className="options-button-group">
                            <button className="delete-button" onClick={() => handleDeleteGoal(optionsPopupGoal.id, optionsPopupGoal.name)} disabled={isProcessingGoalAction}> Delete </button>
                            <button onClick={handleTriggerGoalRename} disabled={isProcessingGoalAction}>Rename / Edit</button>
                            <button onClick={handleCloseGoalOptionsPopup} disabled={isProcessingGoalAction}>Cancel</button>
                         </div>
                     )}
                 </div> {/* End options-popup-content */}
             </div> // End options-overlay
         )} {/* End conditional rendering of goal options popup */}

        </div> // End goals-page-container
    );
    
    
} // End of GoalsPage component needs to be outside this block

export default GoalsPage;