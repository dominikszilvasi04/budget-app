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
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [minimumAmountFilter, setMinimumAmountFilter] = useState('');
  const [maximumAmountFilter, setMaximumAmountFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [activeEditTransaction, setActiveEditTransaction] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [isUpdatingTransaction, setIsUpdatingTransaction] = useState(false);
  const [updateError, setUpdateError] = useState(null);
  const [importStatus, setImportStatus] = useState(null);

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
        const query = new URLSearchParams();
        if (selectedTypeFilter !== 'all') query.append('type', selectedTypeFilter);
        if (selectedCategoryFilter !== 'all') query.append('categoryId', selectedCategoryFilter);
        if (startDateFilter) query.append('startDate', startDateFilter);
        if (endDateFilter) query.append('endDate', endDateFilter);
        if (minimumAmountFilter.trim() !== '') query.append('minAmount', minimumAmountFilter.trim());
        if (maximumAmountFilter.trim() !== '') query.append('maxAmount', maximumAmountFilter.trim());
        if (searchFilter.trim()) query.append('search', searchFilter.trim());

        const response = await axios.get(`http://localhost:5001/api/transactions?${query.toString()}`);
        setTransactions(response.data);
      } catch (error) {
        console.error('Error fetching transactions:', error);
        setTransactionsError('Failed to load transactions.');
      } finally {
        setIsTransactionsLoading(false);
      }
    };

    fetchTransactions();
  }, [
    refreshIndex,
    selectedTypeFilter,
    selectedCategoryFilter,
    startDateFilter,
    endDateFilter,
    minimumAmountFilter,
    maximumAmountFilter,
    searchFilter,
  ]);

  const openEditTransaction = (transaction) => {
    setActiveEditTransaction(transaction);
    setEditAmount(String(transaction.amount));
    setEditDescription(transaction.description || '');
    setEditDate(transaction.transaction_date || '');
    setEditCategoryId(transaction.category_id ? String(transaction.category_id) : '');
    setUpdateError(null);
  };

  const closeEditTransaction = () => {
    setActiveEditTransaction(null);
    setUpdateError(null);
  };

  const handleUpdateTransaction = async (event) => {
    event.preventDefault();
    if (!activeEditTransaction) {
      return;
    }

    const parsedAmount = Number(editAmount);
    const parsedCategoryId = Number(editCategoryId);

    if (!Number.isFinite(parsedAmount) || !editDate || !Number.isInteger(parsedCategoryId)) {
      setUpdateError('Please provide valid amount, date, and category values.');
      return;
    }

    setIsUpdatingTransaction(true);
    setUpdateError(null);

    try {
      await axios.put(`http://localhost:5001/api/transactions/${activeEditTransaction.id}`, {
        amount: parsedAmount,
        description: editDescription,
        transaction_date: editDate,
        category_id: parsedCategoryId,
      });
      setDeleteSuccess('Transaction updated successfully.');
      setTimeout(() => setDeleteSuccess(null), 3000);
      closeEditTransaction();
      setRefreshIndex((currentValue) => currentValue + 1);
    } catch (error) {
      console.error('Error updating transaction:', error);
      setUpdateError(error.response?.data?.message || 'Failed to update transaction.');
    } finally {
      setIsUpdatingTransaction(false);
    }
  };

  const handleExportCsv = () => {
    const query = new URLSearchParams();
    if (selectedTypeFilter !== 'all') query.append('type', selectedTypeFilter);
    if (selectedCategoryFilter !== 'all') query.append('categoryId', selectedCategoryFilter);
    if (startDateFilter) query.append('startDate', startDateFilter);
    if (endDateFilter) query.append('endDate', endDateFilter);
    if (minimumAmountFilter.trim() !== '') query.append('minAmount', minimumAmountFilter.trim());
    if (maximumAmountFilter.trim() !== '') query.append('maxAmount', maximumAmountFilter.trim());
    if (searchFilter.trim()) query.append('search', searchFilter.trim());

    window.open(`http://localhost:5001/api/transactions/export/csv?${query.toString()}`, '_blank');
  };

  const handleImportCsv = async (event) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    setImportStatus('Importing CSV...');

    try {
      const csvText = await selectedFile.text();
      const response = await axios.post('http://localhost:5001/api/transactions/import/csv', { csvText });
      setImportStatus(`Imported ${response.data.importedCount} row(s). Skipped ${response.data.skippedCount}.`);
      setRefreshIndex((currentValue) => currentValue + 1);
    } catch (error) {
      console.error('Error importing CSV:', error);
      setImportStatus(error.response?.data?.message || 'CSV import failed.');
    }

    event.target.value = '';
  };

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

      <div className="history-filter-bar">
        <select value={selectedTypeFilter} onChange={(event) => setSelectedTypeFilter(event.target.value)}>
          <option value="all">All Types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <select value={selectedCategoryFilter} onChange={(event) => setSelectedCategoryFilter(event.target.value)}>
          <option value="all">All Categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>{category.name}</option>
          ))}
        </select>
        <input type="date" value={startDateFilter} onChange={(event) => setStartDateFilter(event.target.value)} />
        <input type="date" value={endDateFilter} onChange={(event) => setEndDateFilter(event.target.value)} />
        <input type="number" step="0.01" placeholder="Min" value={minimumAmountFilter} onChange={(event) => setMinimumAmountFilter(event.target.value)} />
        <input type="number" step="0.01" placeholder="Max" value={maximumAmountFilter} onChange={(event) => setMaximumAmountFilter(event.target.value)} />
        <input type="search" placeholder="Search description" value={searchFilter} onChange={(event) => setSearchFilter(event.target.value)} />
      </div>

      <div className="history-action-row">
        <button type="button" onClick={handleExportCsv}>Export CSV</button>
        <label className="csv-import-label">
          Import CSV
          <input type="file" accept=".csv,text/csv" onChange={handleImportCsv} />
        </label>
        {importStatus && <span className="history-inline-status">{importStatus}</span>}
      </div>

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
                  <div className="history-action-buttons">
                    <button onClick={() => openEditTransaction(transaction)} className="history-edit-btn">Edit</button>
                    <button onClick={() => deleteTransaction(transaction.id)} className="delete-button-history">Delete</button>
                  </div>
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
                  <div className="history-action-buttons">
                    <button onClick={() => openEditTransaction(transaction)} className="history-edit-btn">Edit</button>
                    <button onClick={() => deleteTransaction(transaction.id)} className="delete-button-history">Delete</button>
                  </div>
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
                  <div className="history-action-buttons">
                    <button onClick={() => openEditTransaction(transaction)} className="history-edit-btn">Edit</button>
                    <button onClick={() => deleteTransaction(transaction.id)} className="delete-button-history">Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {activeEditTransaction && (
        <div className="popup-overlay" onClick={closeEditTransaction}>
          <div className="options-popup-content" onClick={(event) => event.stopPropagation()}>
            <h3>Edit Transaction</h3>
            {updateError && <p className="options-error">{updateError}</p>}
            <form onSubmit={handleUpdateTransaction} className="popup-form">
              <div className="form-group">
                <label htmlFor="edit-transaction-amount">Amount</label>
                <input id="edit-transaction-amount" type="number" step="0.01" value={editAmount} onChange={(event) => setEditAmount(event.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="edit-transaction-description">Description</label>
                <input id="edit-transaction-description" type="text" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="edit-transaction-date">Date</label>
                <input id="edit-transaction-date" type="date" value={editDate} onChange={(event) => setEditDate(event.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="edit-transaction-category">Category</label>
                <select id="edit-transaction-category" value={editCategoryId} onChange={(event) => setEditCategoryId(event.target.value)} required>
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
              <div className="options-button-group">
                <button type="button" onClick={closeEditTransaction}>Cancel</button>
                <button type="submit" disabled={isUpdatingTransaction}>{isUpdatingTransaction ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default HistoryPage;