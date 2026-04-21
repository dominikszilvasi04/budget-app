import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Title,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Title);

const formatCurrency = (value) => {
  const parsedValue = typeof value === 'number' ? value : parseFloat(value);
  const safeValue = Number.isNaN(parsedValue) ? 0 : parsedValue;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD' }).format(safeValue);
};

function InsightsPage() {
  const [monthsWindow, setMonthsWindow] = useState('12');
  const [insightData, setInsightData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    const fetchInsights = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const response = await axios.get(`http://localhost:5001/api/transactions/insights/summary?months=${monthsWindow}`);
        setInsightData(response.data);
      } catch (error) {
        console.error('Error fetching insights:', error);
        setErrorMessage('Failed to fetch insights.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchInsights();
  }, [monthsWindow]);

  const monthlyTrendData = useMemo(() => {
    if (!insightData?.monthly?.length) {
      return null;
    }

    return {
      labels: insightData.monthly.map((item) => item.period),
      datasets: [
        {
          label: 'Income',
          data: insightData.monthly.map((item) => item.income_total),
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.25)',
          tension: 0.25,
        },
        {
          label: 'Expenses',
          data: insightData.monthly.map((item) => item.expense_total),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.25)',
          tension: 0.25,
        },
        {
          label: 'Net',
          data: insightData.monthly.map((item) => item.net_total),
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.25)',
          tension: 0.25,
        },
      ],
    };
  }, [insightData]);

  const topCategoriesData = useMemo(() => {
    if (!insightData?.topCategories?.length) {
      return null;
    }

    return {
      labels: insightData.topCategories.map((item) => `${item.name} (${item.type})`),
      datasets: [
        {
          label: 'Total Amount',
          data: insightData.topCategories.map((item) => item.total_amount),
          backgroundColor: insightData.topCategories.map((item) => (item.type === 'income' ? 'rgba(16, 185, 129, 0.65)' : 'rgba(239, 68, 68, 0.65)')),
          borderColor: insightData.topCategories.map((item) => (item.type === 'income' ? '#10b981' : '#ef4444')),
          borderWidth: 1,
        },
      ],
    };
  }, [insightData]);

  const totals = useMemo(() => {
    if (!insightData?.monthly?.length) {
      return {
        income: 0,
        expense: 0,
        net: 0,
      };
    }

    return insightData.monthly.reduce(
      (accumulator, item) => ({
        income: accumulator.income + Number(item.income_total || 0),
        expense: accumulator.expense + Number(item.expense_total || 0),
        net: accumulator.net + Number(item.net_total || 0),
      }),
      { income: 0, expense: 0, net: 0 }
    );
  }, [insightData]);

  if (isLoading) {
    return <div className="page-status">Loading insights...</div>;
  }

  if (errorMessage) {
    return <div className="page-status page-status-error">Error: {errorMessage}</div>;
  }

  return (
    <div className="history-page-container">
      <h2>Insights</h2>
      <p className="section-subtitle">Explore trends, top categories, and net movement over time.</p>

      <div className="history-action-row">
        <label htmlFor="insights-month-window">Period</label>
        <select id="insights-month-window" value={monthsWindow} onChange={(event) => setMonthsWindow(event.target.value)}>
          <option value="3">Last 3 months</option>
          <option value="6">Last 6 months</option>
          <option value="12">Last 12 months</option>
          <option value="24">Last 24 months</option>
        </select>
      </div>

      <div className="insight-stat-grid">
        <div className="history-summary-text">
          <h4>Total Income</h4>
          <p><span className="income-text">{formatCurrency(totals.income)}</span></p>
        </div>
        <div className="history-summary-text">
          <h4>Total Expenses</h4>
          <p><span className="expense-text">{formatCurrency(totals.expense)}</span></p>
        </div>
        <div className="history-summary-text">
          <h4>Net</h4>
          <p><span className={totals.net >= 0 ? 'income-text' : 'expense-text'}>{formatCurrency(totals.net)}</span></p>
        </div>
      </div>

      <div className="history-summary-row">
        <div className="history-chart-container">
          {monthlyTrendData ? (
            <Line
              data={monthlyTrendData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'Monthly Trend' } },
              }}
            />
          ) : (
            <div className="chart-placeholder">No monthly trend data available.</div>
          )}
        </div>

        <div className="history-chart-container">
          {topCategoriesData ? (
            <Bar
              data={topCategoriesData}
              options={{
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'Top Categories' }, legend: { display: false } },
              }}
            />
          ) : (
            <div className="chart-placeholder">No category insight data available.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default InsightsPage;
