import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const formatCurrency = (num) => {
    const parsedNum = typeof num === 'number' ? num : parseFloat(num);
    if (isNaN(parsedNum)) { num = 0; } else { num = parsedNum; }
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD' }).format(num);
};

const safeParseGoalFloat = (value) => {
    if (typeof value === 'number') return value > 0 ? value : NaN;
    if (typeof value !== 'string') return NaN;
    if (value.trim() === '') return NaN;
    const cleanedValue = value.replace(/[\$,]/g, '').trim();
    if (cleanedValue === '') return NaN;
    const parsed = parseFloat(cleanedValue);
    return isNaN(parsed) || parsed <= 0 ? NaN : parsed;
};


function GoalsPage() {
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

    const [contributionPopupGoal, setContributionPopupGoal] = useState(null);
    const [contributionAmount, setContributionAmount] = useState('');
    const [contributionNotes, setContributionNotes] = useState('');
    const [isAddingContribution, setIsAddingContribution] = useState(false);
    const [addContributionError, setAddContributionError] = useState(null);
    const [addContributionSuccess, setAddContributionSuccess] = useState(null);

    const [optionsPopupGoal, setOptionsPopupGoal] = useState(null);
    const [isGoalRenameMode, setIsGoalRenameMode] = useState(false);
    const [renameGoalNameInput, setRenameGoalNameInput] = useState('');
    const [renameTargetAmountInput, setRenameTargetAmountInput] = useState('');
    const [renameTargetDateInput, setRenameTargetDateInput] = useState('');
    const [renameNotesInput, setRenameNotesInput] = useState('');
    const [isProcessingGoalAction, setIsProcessingGoalAction] = useState(false);
    const [goalActionError, setGoalActionError] = useState(null);


    const fetchGoals = useCallback(async (controller) => {
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get('http://localhost:5001/api/goals', {
                signal: controller?.signal
            });
            setGoals(response.data);
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
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        fetchGoals(controller);
        return () => controller.abort();
    }, [fetchGoals]);


    const handleAddGoalSubmit = async (event) => {
        event.preventDefault();
        const trimmedName = goalName.trim();
        const parsedTarget = safeParseGoalFloat(goalTargetAmount);

        if (!trimmedName) { setAddGoalError("Goal name is required."); return; }
        if (isNaN(parsedTarget)) { setAddGoalError("Valid positive target amount is required."); return; }

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
            setGoals(prevGoals =>
                [...prevGoals, response.data.newGoal].sort((a, b) => a.name.localeCompare(b.name))
            );
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

    const handleOpenContributionPopup = (goal) => {
        setContributionPopupGoal(goal);
        setContributionAmount('');
        setContributionNotes('');
        setAddContributionError(null);
        setAddContributionSuccess(null);
    };

    const handleCloseContributionPopup = () => {
        setContributionPopupGoal(null);
    };

    const handleAddContributionSubmit = async (event) => {
        event.preventDefault();
        if (!contributionPopupGoal) return;

        const parsedAmount = safeParseGoalFloat(contributionAmount);

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

            setGoals(prevGoals => prevGoals.map(g =>
                g.id === goalId ? response.data.updatedGoal : g
            ));

            setAddContributionSuccess(`Contribution added to '${contributionPopupGoal.name}'!`);
            setContributionAmount('');
            setContributionNotes('');

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


    const handleGoalOptionsIconClick = (event, goal) => {
        event.stopPropagation();
        setOptionsPopupGoal(goal);
        setRenameGoalNameInput(goal.name);
        setRenameTargetAmountInput(goal.target_amount.toFixed(2));
        setRenameTargetDateInput(goal.target_date || '');
        setRenameNotesInput(goal.notes || '');
        setIsGoalRenameMode(false);
        setGoalActionError(null);
    };

    const handleCloseGoalOptionsPopup = () => {
        setOptionsPopupGoal(null);
        setIsGoalRenameMode(false);
        setGoalActionError(null);
    };

    const handleTriggerGoalRename = () => {
        setIsGoalRenameMode(true);
        setGoalActionError(null);
    };

    const handleCancelGoalRename = () => {
        setIsGoalRenameMode(false);
        setGoalActionError(null);
    };

    const handleUpdateGoalSubmit = async (event) => {
        event.preventDefault();
        if (!optionsPopupGoal) return;

        const goalId = optionsPopupGoal.id;
        const originalGoal = optionsPopupGoal;

        const payload = {};
        let changed = false;

        const newNameTrimmed = renameGoalNameInput.trim();
        if (newNameTrimmed && newNameTrimmed !== originalGoal.name) {
            if (newNameTrimmed.length > 150) { setGoalActionError('Name max 150 chars.'); return; }
            payload.name = newNameTrimmed;
            changed = true;
        } else if (!newNameTrimmed && isGoalRenameMode) {
            setGoalActionError('Goal name is required.'); return;
        }

        const parsedTarget = safeParseGoalFloat(renameTargetAmountInput);
        if (renameTargetAmountInput !== '' && isNaN(parsedTarget)) {
             setGoalActionError('Valid positive target amount required.'); return;
        }
        if (!isNaN(parsedTarget) && parsedTarget !== originalGoal.target_amount) {
            payload.target_amount = parsedTarget;
            changed = true;
        }

        const newDate = renameTargetDateInput || null;
        if (newDate !== originalGoal.target_date) {
            payload.target_date = newDate;
            changed = true;
        }

         const newNotes = renameNotesInput.trim() || null;
        if (newNotes !== (originalGoal.notes || null)) {
            payload.notes = newNotes;
            changed = true;
        }

        if (!changed) {
            handleCloseGoalOptionsPopup();
            return;
        }

        setIsProcessingGoalAction(true);
        setGoalActionError(null);

        try {
            const response = await axios.put(`http://localhost:5001/api/goals/${goalId}`, payload);

            setGoals(prevGoals => prevGoals.map(g =>
                g.id === goalId ? response.data.updatedGoal : g
             ).sort((a, b) => a.name.localeCompare(b.name)));

            handleCloseGoalOptionsPopup();

        } catch (err) {
            console.error("Error updating goal:", err);
            let message = "Failed to update goal.";
            if (err.response?.data?.message) { message = err.response.data.message; }
            setGoalActionError(message);
        } finally {
             setIsProcessingGoalAction(false);
        }
    };


    const handleDeleteGoal = async (goalId, goalName) => {
        if (!window.confirm(`Are you sure you want to delete the goal "${goalName}"? All contributions will also be deleted.`)) {
             return;
        }

        setIsProcessingGoalAction(true);
        setGoalActionError(null);

        try {
            await axios.delete(`http://localhost:5001/api/goals/${goalId}`);
            setGoals(prevGoals => prevGoals.filter(g => g.id !== goalId));
            handleCloseGoalOptionsPopup();
        } catch (err) {
             console.error("Error deleting goal:", err);
             let message = "Failed to delete goal.";
             if (err.response?.data?.message) { message = err.response.data.message; }
             setGoalActionError(message);
        } finally {
             setIsProcessingGoalAction(false);
        }
    };

    if (loading) { return <div className="page-status">Loading goals...</div>; }
    if (error) { return <div className="page-status page-status-error">Error: {error}</div>; }

    return (
        <div className="goals-page-container">
            <h2>Savings Goals</h2>
            <p className="section-subtitle">Track progress clearly and contribute to each goal from one place.</p>

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
                                onChange={(e) => {
                                    setGoalName(e.target.value);
                                    if (addGoalError) setAddGoalError(null);
                                }}
                                maxLength="150" required disabled={isAddingGoal}
                             />
                        </div>
                        <div className="form-group">
                            <label htmlFor="goal-target-amount">Target Amount ($):</label>
                            <input
                                type="number"
                                id="goal-target-amount"
                                value={goalTargetAmount}
                                onChange={(e) => {
                                    setGoalTargetAmount(e.target.value);
                                    if (addGoalError) setAddGoalError(null);
                                }}
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
                            <div className="goal-add-status-container">
                             {addGoalError && <span className="goal-add-status error">{addGoalError}</span>}
                             {addGoalSuccess && <span className="goal-add-status success">{addGoalSuccess}</span>}
                        </div>
                    </div>
                </form>
            </div>

            <div className="goals-list-container">
                <h3>Current Goals</h3>
                {goals.length === 0 && !loading ? ( <p>You haven't added any savings goals yet.</p> ) : (
                    <div className="goals-list">
                        {goals.map(goal => {
                            const targetAmount = Math.max(0.01, goal.target_amount);
                            const currentAmount = Math.max(0, goal.current_amount);
                            const percentage = Math.min(100, Math.max(0, (currentAmount / targetAmount) * 100));
                            const percentageString = percentage.toFixed(1) + '%';

                            return (
                                <div key={goal.id} className="goal-item-card">
                                    <button
                                        className="goal-options-btn"
                                        onClick={(e) => handleGoalOptionsIconClick(e, goal)}
                                        title="Goal Options"
                                        disabled={isProcessingGoalAction && optionsPopupGoal?.id === goal.id}
                                    >
                                        ⋯
                                    </button>

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
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>


            {contributionPopupGoal && (
                <div className="popup-overlay contribution-overlay" onClick={handleCloseContributionPopup}>
                    <div className="popup-content contribution-popup-content" onClick={(e) => e.stopPropagation()}>
                        <h3>Add Contribution to: {contributionPopupGoal.name}</h3>
                         {addContributionError && <p className="options-error">{addContributionError}</p>}
                         {addContributionSuccess && <p className="options-success">{addContributionSuccess}</p>}

                        <form onSubmit={handleAddContributionSubmit} className="contribution-form">
                            <div className="form-group">
                                <label htmlFor="contribution-amount">Amount ($):</label>
                                <input
                                    type="number"
                                    id="contribution-amount"
                                    value={contributionAmount}
                                    onChange={(e) => {
                                        setContributionAmount(e.target.value);
                                        if (addContributionError) setAddContributionError(null);
                                    }}
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
                             <div className="options-button-group">
                                 <button type="button" onClick={handleCloseContributionPopup} disabled={isAddingContribution}>Cancel</button>
                                 <button type="submit" disabled={isAddingContribution || !contributionAmount}>
                                     {isAddingContribution ? 'Adding...' : 'Add Contribution'}
                                 </button>
                             </div>
                        </form>
                    </div>
                </div>
            )}

        {optionsPopupGoal && (
             <div className="popup-overlay options-overlay" onClick={handleCloseGoalOptionsPopup}>
                 <div className="options-popup-content" onClick={(e) => e.stopPropagation()}>
                     <h3>Options for: {optionsPopupGoal.name}</h3>
                     {goalActionError && <p className="options-error">{goalActionError}</p>}

                     {isGoalRenameMode ? (
                         <form onSubmit={handleUpdateGoalSubmit} className="rename-form goal-rename-form">
                            <div className="form-group">
                                 <label htmlFor="rename-goal-name">Goal Name:</label>
                                 <input
                                    id="rename-goal-name"
                                    type="text"
                                    value={renameGoalNameInput}
                                    onChange={(e) => {
                                        setRenameGoalNameInput(e.target.value);
                                        if (goalActionError) setGoalActionError(null);
                                    }}
                                    disabled={isProcessingGoalAction}
                                    maxLength="150"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="form-group">
                                 <label htmlFor="rename-goal-target-amount">Target Amount ($):</label>
                                 <input
                                    id="rename-goal-target-amount"
                                    type="number"
                                    value={renameTargetAmountInput}
                                    onChange={(e) => {
                                        setRenameTargetAmountInput(e.target.value);
                                        if (goalActionError) setGoalActionError(null);
                                    }}
                                    disabled={isProcessingGoalAction}
                                    step="0.01"
                                    min="0.01"
                                    required
                                />
                             </div>
                             <div className="form-group">
                                 <label htmlFor="rename-goal-target-date">Target Date (Optional):</label>
                                 <input
                                    id="rename-goal-target-date"
                                    type="date"
                                    value={renameTargetDateInput}
                                    onChange={(e) => {
                                        setRenameTargetDateInput(e.target.value);
                                        if (goalActionError) setGoalActionError(null);
                                    }}
                                    disabled={isProcessingGoalAction}
                                />
                             </div>
                             <div className="form-group">
                                 <label htmlFor="rename-goal-notes">Notes (Optional):</label>
                                 <textarea
                                    id="rename-goal-notes"
                                    value={renameNotesInput}
                                    onChange={(e) => {
                                        setRenameNotesInput(e.target.value);
                                        if (goalActionError) setGoalActionError(null);
                                    }}
                                    rows="2"
                                    disabled={isProcessingGoalAction}
                                ></textarea>
                             </div>
                             <div className="options-button-group">
                                 <button type="button" onClick={handleCancelGoalRename} disabled={isProcessingGoalAction}>Cancel</button>
                                 <button type="submit" disabled={isProcessingGoalAction}>
                                     {isProcessingGoalAction ? 'Saving...' : 'Save Changes'}
                                 </button>
                             </div>
                         </form>
                     ) : (
                         <div className="options-button-group">
                            <button className="delete-button" onClick={() => handleDeleteGoal(optionsPopupGoal.id, optionsPopupGoal.name)} disabled={isProcessingGoalAction}> Delete </button>
                            <button onClick={handleTriggerGoalRename} disabled={isProcessingGoalAction}>Rename / Edit</button>
                            <button onClick={handleCloseGoalOptionsPopup} disabled={isProcessingGoalAction}>Cancel</button>
                         </div>
                     )}
                 </div>
             </div>
         )}

        </div>
    );
    
    
}

export default GoalsPage;