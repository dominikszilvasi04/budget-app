import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend, Title);

const formatCurrency = (value) => {
  const numericValue = typeof value === 'number' ? value : parseFloat(value);
  const safeValue = Number.isNaN(numericValue) ? 0 : numericValue;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD' }).format(safeValue);
};

const parseNumber = (value) => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value !== 'string') {
    return NaN;
  }

  const trimmedValue = value.trim();
  if (trimmedValue === '') {
    return NaN;
  }

  const parsedValue = parseFloat(trimmedValue);
  return Number.isNaN(parsedValue) ? NaN : parsedValue;
};

const incomeExpenseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
    },
    title: {
      display: true,
      text: 'Income vs Expense Ratio (All Time)',
      font: { size: 16 },
    },
    tooltip: {
      callbacks: {
        label(context) {
          let label = context.label || '';
          if (label) {
            label += ': ';
          }
          if (context.raw !== null && context.raw !== undefined) {
            label += formatCurrency(context.raw);
          }
          return label;
        },
      },
    },
  },
  cutout: '60%',
};

function HistoryPage() {
  const [transactions, setTransactions] = useState([]);
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true);
  const [transactionsError, setTransactionsError] = useState(null);

  const [categories, setCategories] = useState([]);
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState(null);

  const [deleteError, setDeleteError] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchCategories = async () => {
      setIsCategoriesLoading(true);
      setCategoriesError(null);

      try {
        const response = await axios.get('http://localhost:5001/api/categories', {
          signal: abortController.signal,
        });
        setCategories(response.data);
      } catch (error) {
        if (!axios.isCancel(error)) {
          console.error('Error fetching categories for history page:', error);
          setCategoriesError('Failed to load category details.');
        }
      } finally {
        if (!abortController.signal.aborted) {
          setIsCategoriesLoading(false);
        }
      }
    };

    fetchCategories();
    return () => abortController.abort();
  }, []);

  useEffect(() => {
    const fetchTransactions = async () => {
      setIsTransactionsLoading(true);
      setTransactionsError(null);

      try {
        const response = await axios.get('http://localhost:5001/api/transactions');
        setTransactions(response.data);
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setTransactionsError('Failed to load transactions.');
      } finally {
        setIsTransactionsLoading(false);
      }
    };

    fetchTransactions();
  }, [refreshIndex]);

  const deleteTransaction = async (transactionIdentifier) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) {
      return;
    }

    setDeleteError(null);
    setDeleteSuccess(null);

    try {
      const response = await axios.delete(`http://localhost:5001/api/transactions/${transactionIdentifier}`);
      setDeleteSuccess(response.data.message || 'Transaction deleted.');
      setRefreshIndex((currentValue) => currentValue + 1);
      setTimeout(() => setDeleteSuccess(null), 3000);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      const message = error.response?.data?.message || 'Failed to delete transaction.';
      setDeleteError(message);
    }
  };

  const groupedTransactions = useMemo(() => {
    if (isCategoriesLoading || isTransactionsLoading || !categories || !transactions) {
      return {
        income: [],
        expense: [],
        uncategorised: [],
        incomeTotal: 0,
        expenseTotal: 0,
      };
    }

    const categoryTypeByIdentifier = categories.reduce((result, category) => {
      result[category.id] = category.type;
      return result;
    }, {});

    const incomeTransactions = [];
    const expenseTransactions = [];
    const uncategorisedTransactions = [];

    transactions.forEach((transaction) => {
      const categoryIdentifier = transaction.category_id;
      const categoryType = categoryIdentifier !== null ? categoryTypeByIdentifier[categoryIdentifier] : null;

      if (categoryType === 'income') {
        incomeTransactions.push(transaction);
      } else if (categoryType === 'expense') {
        expenseTransactions.push(transaction);
      } else {
        uncategorisedTransactions.push(transaction);
      }
    });

    const incomeTotal = incomeTransactions.reduce((total, transaction) => total + (parseNumber(transaction.amount) || 0), 0);
    const expenseTotal = expenseTransactions.reduce((total, transaction) => total + (parseNumber(transaction.amount) || 0), 0);

    return {
      income: incomeTransactions,
      expense: expenseTransactions,
      uncategorised: uncategorisedTransactions,
      incomeTotal,
      expenseTotal,
    };
  }, [categories, transactions, isCategoriesLoading, isTransactionsLoading]);

  const incomeExpenseChartData = useMemo(() => {
    const { incomeTotal, expenseTotal } = groupedTransactions;

    if (incomeTotal <= 0 && expenseTotal <= 0) {
      return null;
    }

    const labels = [];
    const values = [];
    const backgroundColours = [];

    if (incomeTotal > 0) {
      labels.push('Total Income');
      values.push(incomeTotal);
      backgroundColours.push('hsl(145, 63%, 42%)');
    }

    if (expenseTotal > 0) {
      labels.push('Total Expenses');
      values.push(expenseTotal);
      backgroundColours.push('hsl(349, 83%, 60%)');
    }

    return {
      labels,
      datasets: [
        {
          label: 'Amount',
          data: values,
          backgroundColor: backgroundColours,
          borderColor: ['#FFFFFF', '#FFFFFF'],
          borderWidth: 3,
        },
      ],
    };
  }, [groupedTransactions]);

  const isLoading = isCategoriesLoading || isTransactionsLoading;
  if (isLoading) {
    return <div className="page-status">Loading history data...</div>;
  }

  const displayError = categoriesError || transactionsError;
  if (displayError) {
    return <div className="page-status page-status-error">Error: {displayError}</div>;
  }

  return (
    <div className="history-page-container">
      <h2>Transaction History</h2>
      <p className="section-subtitle">Review income, expenses, and transaction-level detail across all categories.</p>

      {deleteError && <p className="options-error">{deleteError}</p>}
      {deleteSuccess && <p className="options-success">{deleteSuccess}</p>}

      <div className="history-summary-row">
        <div className="history-chart-container">
          {incomeExpenseChartData ? (
            <Doughnut data={incomeExpenseChartData} options={incomeExpenseChartOptions} />
          ) : (
            <div className="chart-placeholder">No income or expense data for chart.</div>
          )}
        </div>

        <div className="history-summary-text">
          <h4>Summary (All Time)</h4>
          <p>
            Total Income: <span className="income-text">{formatCurrency(groupedTransactions.incomeTotal)}</span>
          </p>
          <p>
            Total Expenses: <span className="expense-text">{formatCurrency(groupedTransactions.expenseTotal)}</span>
          </p>
          <hr />
          <p>
            Surplus:
            <span className={groupedTransactions.incomeTotal >= groupedTransactions.expenseTotal ? 'income-text' : 'expense-text'}>
              {formatCurrency(groupedTransactions.incomeTotal - groupedTransactions.expenseTotal)}
            </span>
          </p>
        </div>
      </div>

      <div className="history-details-section">
        <div className="history-type-section">
          <h3>Income (+{formatCurrency(groupedTransactions.incomeTotal)})</h3>
          {groupedTransactions.income.length === 0 ? (
            <p className="no-transactions-msg">No income transactions recorded.</p>
          ) : (
            <ul>
              {groupedTransactions.income.map((transaction) => (
                <li key={transaction.id}>
                  <span className="history-date">{transaction.transaction_date}</span>
                  <span className="history-category">({transaction.category_name || 'N/A'})</span>
                  <span className="history-desc">{transaction.description || <span className="empty-description">No description</span>}</span>
                  <span className="history-amount income">{formatCurrency(transaction.amount)}</span>
                  <button onClick={() => deleteTransaction(transaction.id)} className="delete-button-history">Delete</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="history-type-section">
          <h3>Expenses (-{formatCurrency(groupedTransactions.expenseTotal)})</h3>
          {groupedTransactions.expense.length === 0 ? (
            <p className="no-transactions-msg">No expense transactions recorded.</p>
          ) : (
            <ul>
              {groupedTransactions.expense.map((transaction) => (
                <li key={transaction.id}>
                  <span className="history-date">{transaction.transaction_date}</span>
                  <span className="history-category">({transaction.category_name || 'N/A'})</span>
                  <span className="history-desc">{transaction.description || <span className="empty-description">No description</span>}</span>
                  <span className="history-amount expense">{formatCurrency(transaction.amount)}</span>
                  <button onClick={() => deleteTransaction(transaction.id)} className="delete-button-history">Delete</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {groupedTransactions.uncategorised.length > 0 && (
          <div className="history-type-section uncategorized">
            <h3>Uncategorised</h3>
            <ul>
              {groupedTransactions.uncategorised.map((transaction) => (
                <li key={transaction.id}>
                  <span className="history-date">{transaction.transaction_date}</span>
                  <span className="history-desc">{transaction.description || <span className="empty-description">No description</span>}</span>
                  <span className="history-amount">{formatCurrency(transaction.amount)}</span>
                  <button onClick={() => deleteTransaction(transaction.id)} className="delete-button-history">Delete</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoryPage;