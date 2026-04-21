import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const defaultRuleState = {
  description: '',
  amount: '',
  category_id: '',
  interval_type: 'monthly',
  day_of_month: '1',
  day_of_week: '1',
  start_date: new Date().toISOString().split('T')[0],
  is_active: true,
};

function RecurringPage() {
  const [categories, setCategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [formState, setFormState] = useState(defaultRuleState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const activeRuleCount = useMemo(() => rules.filter((rule) => rule.is_active).length, [rules]);

  const fetchData = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [categoriesResponse, rulesResponse] = await Promise.all([
        axios.get('http://localhost:5001/api/categories'),
        axios.get('http://localhost:5001/api/transactions/recurring/list'),
      ]);
      setCategories(categoriesResponse.data);
      setRules(rulesResponse.data);
    } catch (error) {
      console.error('Error fetching recurring setup data:', error);
      setErrorMessage('Failed to load recurring transactions.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateRule = async (event) => {
    event.preventDefault();

    const parsedAmount = Number(formState.amount);
    const parsedCategoryId = Number(formState.category_id);

    if (!Number.isFinite(parsedAmount) || !Number.isInteger(parsedCategoryId) || !formState.start_date) {
      setErrorMessage('Please provide valid amount, category, and start date.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await axios.post('http://localhost:5001/api/transactions/recurring', {
        description: formState.description || null,
        amount: parsedAmount,
        category_id: parsedCategoryId,
        interval_type: formState.interval_type,
        day_of_month: formState.interval_type === 'monthly' ? Number(formState.day_of_month) : null,
        day_of_week: formState.interval_type === 'weekly' ? Number(formState.day_of_week) : null,
        start_date: formState.start_date,
        is_active: Boolean(formState.is_active),
      });
      setStatusMessage('Recurring rule created.');
      setFormState(defaultRuleState);
      await fetchData();
    } catch (error) {
      console.error('Error creating recurring rule:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to create recurring rule.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleRule = async (rule) => {
    try {
      await axios.put(`http://localhost:5001/api/transactions/recurring/${rule.id}`, {
        ...rule,
        is_active: !rule.is_active,
      });
      setStatusMessage(`Rule ${rule.is_active ? 'paused' : 'activated'}.`);
      await fetchData();
    } catch (error) {
      console.error('Error toggling recurring rule:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to update recurring rule.');
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Delete this recurring rule?')) {
      return;
    }

    try {
      await axios.delete(`http://localhost:5001/api/transactions/recurring/${ruleId}`);
      setStatusMessage('Recurring rule deleted.');
      await fetchData();
    } catch (error) {
      console.error('Error deleting recurring rule:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to delete recurring rule.');
    }
  };

  const handleProcessRules = async () => {
    try {
      const response = await axios.post('http://localhost:5001/api/transactions/recurring/process');
      setStatusMessage(`${response.data.createdTransactionCount} recurring transaction(s) created.`);
      await fetchData();
    } catch (error) {
      console.error('Error processing recurring rules:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to process recurring rules.');
    }
  };

  if (isLoading) {
    return <div className="page-status">Loading recurring setup...</div>;
  }

  return (
    <div className="goals-page-container">
      <h2>Recurring Transactions</h2>
      <p className="section-subtitle">Automate regular income and expense entries with weekly or monthly rules.</p>

      <div className="history-action-row">
        <button type="button" onClick={handleProcessRules}>Process Due Rules Now</button>
        <span className="history-inline-status">Active rules: {activeRuleCount}</span>
      </div>

      {errorMessage && <p className="options-error">{errorMessage}</p>}
      {statusMessage && <p className="options-success">{statusMessage}</p>}

      <div className="add-goal-form-container">
        <h3>Create Recurring Rule</h3>
        <form onSubmit={handleCreateRule} className="add-goal-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="recurring-description">Description</label>
              <input
                id="recurring-description"
                type="text"
                value={formState.description}
                onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
              />
            </div>
            <div className="form-group">
              <label htmlFor="recurring-amount">Amount</label>
              <input
                id="recurring-amount"
                type="number"
                step="0.01"
                required
                value={formState.amount}
                onChange={(event) => setFormState((current) => ({ ...current, amount: event.target.value }))}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="recurring-category">Category</label>
              <select
                id="recurring-category"
                required
                value={formState.category_id}
                onChange={(event) => setFormState((current) => ({ ...current, category_id: event.target.value }))}
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name} ({category.type})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="recurring-interval">Interval</label>
              <select
                id="recurring-interval"
                value={formState.interval_type}
                onChange={(event) => setFormState((current) => ({ ...current, interval_type: event.target.value }))}
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            {formState.interval_type === 'monthly' ? (
              <div className="form-group">
                <label htmlFor="recurring-day-of-month">Day of month</label>
                <input
                  id="recurring-day-of-month"
                  type="number"
                  min="1"
                  max="31"
                  value={formState.day_of_month}
                  onChange={(event) => setFormState((current) => ({ ...current, day_of_month: event.target.value }))}
                />
              </div>
            ) : (
              <div className="form-group">
                <label htmlFor="recurring-day-of-week">Day of week</label>
                <select
                  id="recurring-day-of-week"
                  value={formState.day_of_week}
                  onChange={(event) => setFormState((current) => ({ ...current, day_of_week: event.target.value }))}
                >
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
              </div>
            )}
            <div className="form-group">
              <label htmlFor="recurring-start-date">Start date</label>
              <input
                id="recurring-start-date"
                type="date"
                value={formState.start_date}
                onChange={(event) => setFormState((current) => ({ ...current, start_date: event.target.value }))}
              />
            </div>
          </div>
          <div className="form-row submit-row">
            <button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Create Rule'}</button>
          </div>
        </form>
      </div>

      <div className="goals-list-container">
        <h3>Existing Rules</h3>
        {rules.length === 0 ? (
          <p className="empty-state-message">No recurring rules defined yet.</p>
        ) : (
          <div className="goals-list">
            {rules.map((rule) => (
              <div key={rule.id} className="goal-item-card">
                <h4>{rule.description || 'Untitled recurring transaction'}</h4>
                <p>Amount: {Number(rule.amount).toFixed(2)}</p>
                <p>Category: {rule.category_name || 'N/A'}</p>
                <p>Interval: {rule.interval_type}</p>
                <p>Starts: {rule.start_date}</p>
                <p>Last processed: {rule.last_processed_date || 'Never'}</p>
                <div className="history-action-row">
                  <button type="button" onClick={() => handleToggleRule(rule)}>{rule.is_active ? 'Pause' : 'Activate'}</button>
                  <button type="button" className="delete-button-history" onClick={() => handleDeleteRule(rule.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default RecurringPage;
