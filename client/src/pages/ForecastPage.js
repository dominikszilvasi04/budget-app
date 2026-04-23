import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Title);

const formatCurrency = (value) => {
  const parsedValue = typeof value === 'number' ? value : parseFloat(value);
  const safeValue = Number.isNaN(parsedValue) ? 0 : parsedValue;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD' }).format(safeValue);
};

const defaultPlannedState = {
  description: '',
  amount: '',
  category_id: '',
  frequency: 'one_time',
  planned_date: new Date().toISOString().split('T')[0],
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
  day_of_week: '1',
  day_of_month: '1',
  scenario: 'base',
  is_active: true,
  notes: '',
};

function ForecastPage() {
  const [monthsAhead, setMonthsAhead] = useState('6');
  const [historyMonths, setHistoryMonths] = useState('12');
  const [scenario, setScenario] = useState('base');
  const [includePlanned, setIncludePlanned] = useState(true);

  const [forecastData, setForecastData] = useState(null);
  const [plannedRows, setPlannedRows] = useState([]);
  const [categories, setCategories] = useState([]);

  const [formState, setFormState] = useState(defaultPlannedState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [forecastResponse, plannedResponse, categoriesResponse] = await Promise.all([
        axios.get('http://localhost:5001/api/transactions/forecast', {
          params: {
            monthsAhead,
            historyMonths,
            scenario,
            includePlanned,
          },
        }),
        axios.get('http://localhost:5001/api/transactions/planned', {
          params: {
            scenario,
          },
        }),
        axios.get('http://localhost:5001/api/categories'),
      ]);

      setForecastData(forecastResponse.data);
      setPlannedRows(plannedResponse.data || []);
      setCategories(categoriesResponse.data || []);
    } catch (error) {
      console.error('Error loading forecast data:', error);
      setErrorMessage('Failed to load forecast data.');
    } finally {
      setIsLoading(false);
    }
  }, [monthsAhead, historyMonths, scenario, includePlanned]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreatePlannedTransaction = async (event) => {
    event.preventDefault();

    const payload = {
      ...formState,
      amount: Number(formState.amount),
      category_id: Number(formState.category_id),
    };

    setIsSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await axios.post('http://localhost:5001/api/transactions/planned', payload);
      setStatusMessage('Planned transaction created.');
      setFormState(defaultPlannedState);
      await fetchData();
    } catch (error) {
      console.error('Error creating planned transaction:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to create planned transaction.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlannedTransaction = async (plannedTransactionId) => {
    if (!window.confirm('Delete this planned transaction?')) {
      return;
    }

    setErrorMessage(null);
    setStatusMessage(null);

    try {
      await axios.delete(`http://localhost:5001/api/transactions/planned/${plannedTransactionId}`);
      setStatusMessage('Planned transaction deleted.');
      await fetchData();
    } catch (error) {
      console.error('Error deleting planned transaction:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to delete planned transaction.');
    }
  };

  const forecastChartData = useMemo(() => {
    if (!forecastData?.months?.length) {
      return null;
    }

    return {
      labels: forecastData.months.map((month) => month.period),
      datasets: [
        {
          label: 'Projected Income',
          data: forecastData.months.map((month) => month.projected_income),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.20)',
          tension: 0.2,
        },
        {
          label: 'Projected Expenses',
          data: forecastData.months.map((month) => month.projected_expense),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.20)',
          tension: 0.2,
        },
        {
          label: 'Projected Net',
          data: forecastData.months.map((month) => month.projected_net),
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.20)',
          tension: 0.2,
        },
      ],
    };
  }, [forecastData]);

  if (isLoading) {
    return <div className="page-status">Loading forecast data...</div>;
  }

  return (
    <div className="history-page-container">
      <h2>Forecast Planner</h2>
      <p className="section-subtitle">Project income and expenses with what-if planned transactions.</p>

      <div className="history-action-row forecast-control-row">
        <label htmlFor="forecast-months-ahead">Months ahead</label>
        <select id="forecast-months-ahead" value={monthsAhead} onChange={(event) => setMonthsAhead(event.target.value)}>
          <option value="3">3</option>
          <option value="6">6</option>
          <option value="12">12</option>
          <option value="18">18</option>
          <option value="24">24</option>
        </select>

        <label htmlFor="forecast-history-months">History window</label>
        <select id="forecast-history-months" value={historyMonths} onChange={(event) => setHistoryMonths(event.target.value)}>
          <option value="6">6</option>
          <option value="12">12</option>
          <option value="24">24</option>
          <option value="36">36</option>
        </select>

        <label htmlFor="forecast-scenario">Scenario</label>
        <input
          id="forecast-scenario"
          type="text"
          value={scenario}
          onChange={(event) => setScenario(event.target.value || 'base')}
        />

        <label htmlFor="forecast-include-planned">Use planned</label>
        <input
          id="forecast-include-planned"
          type="checkbox"
          checked={includePlanned}
          onChange={(event) => setIncludePlanned(event.target.checked)}
        />
      </div>

      {errorMessage && <p className="options-error">{errorMessage}</p>}
      {statusMessage && <p className="options-success">{statusMessage}</p>}

      <div className="insight-stat-grid">
        <div className="history-summary-text">
          <h4>Projected Income</h4>
          <p><span className="income-text">{formatCurrency(forecastData?.summary?.projected_income_total || 0)}</span></p>
        </div>
        <div className="history-summary-text">
          <h4>Projected Expenses</h4>
          <p><span className="expense-text">{formatCurrency(forecastData?.summary?.projected_expense_total || 0)}</span></p>
        </div>
        <div className="history-summary-text">
          <h4>Projected Net</h4>
          <p>
            <span className={(forecastData?.summary?.projected_net_total || 0) >= 0 ? 'income-text' : 'expense-text'}>
              {formatCurrency(forecastData?.summary?.projected_net_total || 0)}
            </span>
          </p>
        </div>
      </div>

      <div className="history-chart-container forecast-chart-container">
        {forecastChartData ? (
          <Line
            data={forecastChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { title: { display: true, text: 'Forecast Trend' } },
            }}
          />
        ) : (
          <div className="chart-placeholder">No forecast data available.</div>
        )}
      </div>

      <div className="budget-content-layout forecast-layout">
        <div className="add-goal-form-container">
          <h3>Add Planned Transaction</h3>
          <form className="add-goal-form" onSubmit={handleCreatePlannedTransaction}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="planned-description">Description</label>
                <input
                  id="planned-description"
                  type="text"
                  value={formState.description}
                  onChange={(event) => setFormState((current) => ({ ...current, description: event.target.value }))}
                />
              </div>
              <div className="form-group">
                <label htmlFor="planned-amount">Amount</label>
                <input
                  id="planned-amount"
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
                <label htmlFor="planned-category">Category</label>
                <select
                  id="planned-category"
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
                <label htmlFor="planned-frequency">Frequency</label>
                <select
                  id="planned-frequency"
                  value={formState.frequency}
                  onChange={(event) => setFormState((current) => ({ ...current, frequency: event.target.value }))}
                >
                  <option value="one_time">One time</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>

            {formState.frequency === 'one_time' ? (
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="planned-date">Planned date</label>
                  <input
                    id="planned-date"
                    type="date"
                    value={formState.planned_date}
                    onChange={(event) => setFormState((current) => ({ ...current, planned_date: event.target.value }))}
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="planned-start-date">Start date</label>
                    <input
                      id="planned-start-date"
                      type="date"
                      value={formState.start_date}
                      onChange={(event) => setFormState((current) => ({ ...current, start_date: event.target.value }))}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="planned-end-date">End date (optional)</label>
                    <input
                      id="planned-end-date"
                      type="date"
                      value={formState.end_date}
                      onChange={(event) => setFormState((current) => ({ ...current, end_date: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-row">
                  {formState.frequency === 'weekly' ? (
                    <div className="form-group">
                      <label htmlFor="planned-day-of-week">Day of week</label>
                      <select
                        id="planned-day-of-week"
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
                  ) : (
                    <div className="form-group">
                      <label htmlFor="planned-day-of-month">Day of month</label>
                      <input
                        id="planned-day-of-month"
                        type="number"
                        min="1"
                        max="31"
                        value={formState.day_of_month}
                        onChange={(event) => setFormState((current) => ({ ...current, day_of_month: event.target.value }))}
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="planned-row-scenario">Scenario</label>
                    <input
                      id="planned-row-scenario"
                      type="text"
                      value={formState.scenario}
                      onChange={(event) => setFormState((current) => ({ ...current, scenario: event.target.value }))}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="form-row submit-row">
              <button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Create Planned Transaction'}</button>
            </div>
          </form>
        </div>

        <div className="goals-list-container">
          <h3>Planned Transactions</h3>
          {plannedRows.length === 0 ? (
            <p className="empty-state-message">No planned transactions for this scenario yet.</p>
          ) : (
            <div className="goals-list">
              {plannedRows.map((row) => (
                <div key={row.id} className="goal-item-card">
                  <h4>{row.description || 'Untitled plan'}</h4>
                  <p>Amount: {formatCurrency(row.amount)}</p>
                  <p>Category: {row.category_name || 'N/A'}</p>
                  <p>Frequency: {row.frequency}</p>
                  <p>Scenario: {row.scenario}</p>
                  <p>
                    Date:
                    {' '}
                    {row.frequency === 'one_time'
                      ? row.planned_date
                      : `${row.start_date}${row.end_date ? ` to ${row.end_date}` : ''}`}
                  </p>
                  <div className="history-action-row">
                    <button
                      type="button"
                      className="delete-button-history"
                      onClick={() => handleDeletePlannedTransaction(row.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ForecastPage;
