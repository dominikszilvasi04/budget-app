import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, Title } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend, Title);

const formatCurrency = (value) => {
    const parsedValue = typeof value === 'number' ? value : parseFloat(value);
    const safeValue = Number.isNaN(parsedValue) ? 0 : parsedValue;
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'USD' }).format(safeValue);
};

const parseBudgetAmount = (value) => {
    if (typeof value === 'number') {
        return value >= 0 ? value : NaN;
    }

    if (typeof value !== 'string') {
        return NaN;
    }

    const sanitisedValue = value.replace(/[$,]/g, '').trim();
    if (sanitisedValue === '') {
        return 0;
    }

    const parsedValue = parseFloat(sanitisedValue);
    if (Number.isNaN(parsedValue) || parsedValue < 0) {
        return NaN;
    }

    return parsedValue;
};

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { position: 'top' },
        title: { display: true, text: 'Budget Allocation by Category (Current Month)', font: { size: 16 } },
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
};

function BudgetPage() {
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [budgets, setBudgets] = useState([]);
    const [isBudgetsLoading, setIsBudgetsLoading] = useState(true);
    const [budgetsError, setBudgetsError] = useState(null);

    const [categories, setCategories] = useState([]);
    const [isCategoriesLoading, setIsCategoriesLoading] = useState(true);
    const [categoriesError, setCategoriesError] = useState(null);

    const [saveStatusByCategoryIdentifier, setSaveStatusByCategoryIdentifier] = useState({});
    const [selectedMonth, setSelectedMonth] = useState(defaultMonth);
    const [rolloverStatus, setRolloverStatus] = useState(null);

    const fetchBudgets = useCallback(async (abortController) => {
        setIsBudgetsLoading(true);
        setBudgetsError(null);

        const [yearText, monthText] = selectedMonth.split('-');
        const selectedYear = Number(yearText);
        const selectedMonthNumber = Number(monthText);

        try {
            const response = await axios.get('http://localhost:5001/api/budgets/current', {
                signal: abortController?.signal,
                params: { year: selectedYear, month: selectedMonthNumber },
            });
            const budgetItems = response.data?.items || [];
            const initialisedBudgets = budgetItems.map((budget) => ({
                ...budget,
                budget_amount: budget.budget_amount ?? 0,
            }));
            setBudgets(initialisedBudgets);
        } catch (error) {
            if (!axios.isCancel(error)) {
                console.error('Error fetching budget data:', error);
                setBudgetsError('Failed to load budget data.');
            }
        } finally {
            if (!abortController?.signal?.aborted) {
                setIsBudgetsLoading(false);
            }
        }
    }, [selectedMonth]);

    useEffect(() => {
        const abortController = new AbortController();
        fetchBudgets(abortController);
        return () => abortController.abort();
    }, [fetchBudgets]);

    const shiftSelectedMonth = (monthDelta) => {
        const [yearText, monthText] = selectedMonth.split('-');
        const updatedDate = new Date(Number(yearText), Number(monthText) - 1 + monthDelta, 1);
        const updatedMonth = `${updatedDate.getFullYear()}-${String(updatedDate.getMonth() + 1).padStart(2, '0')}`;
        setSelectedMonth(updatedMonth);
        setRolloverStatus(null);
    };

    const rolloverFromPreviousMonth = async () => {
        const [yearText, monthText] = selectedMonth.split('-');
        const targetDate = new Date(Number(yearText), Number(monthText) - 1, 1);
        const previousDate = new Date(targetDate.getFullYear(), targetDate.getMonth() - 1, 1);

        try {
            const response = await axios.post('http://localhost:5001/api/budgets/rollover', {
                fromYear: previousDate.getFullYear(),
                fromMonth: previousDate.getMonth() + 1,
                toYear: targetDate.getFullYear(),
                toMonth: targetDate.getMonth() + 1,
            });
            setRolloverStatus(`${response.data.copiedRowCount} budget row(s) copied from previous month.`);
            const controller = new AbortController();
            await fetchBudgets(controller);
            controller.abort();
        } catch (error) {
            console.error('Error rolling over budgets:', error);
            setRolloverStatus(error.response?.data?.message || 'Budget rollover failed.');
        }
    };

    useEffect(() => {
        const abortController = new AbortController();

        const fetchCategories = async () => {
            setIsCategoriesLoading(true);
            setCategoriesError(null);

            try {
                const response = await axios.get('http://localhost:5001/api/categories', { signal: abortController.signal });
                setCategories(response.data);
            } catch (error) {
                if (!axios.isCancel(error)) {
                    console.error('Error fetching category details for budget page:', error);
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

    const categoryTypeByIdentifier = useMemo(() => {
        if (isCategoriesLoading || !categories) {
            return {};
        }

        return categories.reduce((result, category) => {
            result[category.id] = category.type;
            return result;
        }, {});
    }, [categories, isCategoriesLoading]);

    const expenseBudgets = useMemo(() => {
        if (isBudgetsLoading || isCategoriesLoading || !budgets || !categories) {
            return [];
        }

        return budgets.filter((budget) => categoryTypeByIdentifier[budget.id] === 'expense');
    }, [budgets, categories, categoryTypeByIdentifier, isBudgetsLoading, isCategoriesLoading]);

    const pieChartData = useMemo(() => {
        if (isBudgetsLoading || isCategoriesLoading || !budgets || !categories) {
            return null;
        }

        const categoryColourByIdentifier = categories.reduce((result, category) => {
            result[category.id] = category.color || '#CCCCCC';
            return result;
        }, {});

        const filteredBudgets = budgets.filter((budget) => (
            budget.budget_amount > 0 && categoryTypeByIdentifier[budget.id] === 'expense'
        ));

        if (filteredBudgets.length === 0) {
            return null;
        }

        return {
            labels: filteredBudgets.map((budget) => budget.name),
            datasets: [
                {
                    label: 'Budget Amount',
                    data: filteredBudgets.map((budget) => budget.budget_amount),
                    backgroundColor: filteredBudgets.map((budget) => categoryColourByIdentifier[budget.id] || '#CCCCCC'),
                    borderColor: 'black',
                    borderWidth: 1,
                },
            ],
        };
    }, [budgets, categories, categoryTypeByIdentifier, isBudgetsLoading, isCategoriesLoading]);

    const updateBudgetInput = (categoryIdentifier, inputValue) => {
        setBudgets((currentBudgets) => currentBudgets.map((budget) => (
            budget.id === categoryIdentifier
                ? { ...budget, budget_amount_input: inputValue }
                : budget
        )));

        if (saveStatusByCategoryIdentifier[categoryIdentifier]) {
            setSaveStatusByCategoryIdentifier((currentStatus) => ({
                ...currentStatus,
                [categoryIdentifier]: null,
            }));
        }
    };

    const saveBudget = async (categoryIdentifier) => {
        const selectedBudget = budgets.find((budget) => budget.id === categoryIdentifier);
        if (!selectedBudget) {
            return;
        }

        const valueToSave = selectedBudget.budget_amount_input !== undefined
            ? selectedBudget.budget_amount_input
            : selectedBudget.budget_amount;

        const parsedAmount = parseBudgetAmount(valueToSave);

        if (Number.isNaN(parsedAmount)) {
            setSaveStatusByCategoryIdentifier((currentStatus) => ({
                ...currentStatus,
                [categoryIdentifier]: { status: 'error', message: 'Invalid number' },
            }));

            setTimeout(() => {
                setBudgets((currentBudgets) => currentBudgets.map((budget) => (
                    budget.id === categoryIdentifier
                        ? { ...budget, budget_amount_input: budget.budget_amount?.toFixed(2) ?? '0.00' }
                        : budget
                )));

                setSaveStatusByCategoryIdentifier((currentStatus) => ({
                    ...currentStatus,
                    [categoryIdentifier]: null,
                }));
            }, 2000);

            return;
        }

        if (parsedAmount === selectedBudget.budget_amount) {
            if (selectedBudget.budget_amount_input !== undefined) {
                setBudgets((currentBudgets) => currentBudgets.map((budget) => (
                    budget.id === categoryIdentifier
                        ? { ...budget, budget_amount_input: undefined }
                        : budget
                )));
            }
            return;
        }

        setSaveStatusByCategoryIdentifier((currentStatus) => ({
            ...currentStatus,
            [categoryIdentifier]: { status: 'saving' },
        }));

        try {
            const response = await axios.put('http://localhost:5001/api/budgets/set', {
                categoryId: categoryIdentifier,
                amount: parsedAmount,
                year: Number(selectedMonth.split('-')[0]),
                month: Number(selectedMonth.split('-')[1]),
            });

            setBudgets((currentBudgets) => currentBudgets.map((budget) => (
                budget.id === categoryIdentifier
                    ? {
                        ...budget,
                        budget_amount: response.data.budget.budget_amount,
                        budget_amount_input: undefined,
                    }
                    : budget
            )));

            setSaveStatusByCategoryIdentifier((currentStatus) => ({
                ...currentStatus,
                [categoryIdentifier]: { status: 'saved' },
            }));

            setTimeout(() => {
                setSaveStatusByCategoryIdentifier((currentStatus) => ({
                    ...currentStatus,
                    [categoryIdentifier]: null,
                }));
            }, 2000);
        } catch (error) {
            console.error('Error saving budget:', error);
            const message = error.response?.data?.message || 'Save failed';

            setSaveStatusByCategoryIdentifier((currentStatus) => ({
                ...currentStatus,
                [categoryIdentifier]: { status: 'error', message },
            }));

            setTimeout(() => {
                setBudgets((currentBudgets) => currentBudgets.map((budget) => (
                    budget.id === categoryIdentifier
                        ? { ...budget, budget_amount_input: budget.budget_amount?.toFixed(2) ?? '0.00' }
                        : budget
                )));
            }, 2000);
        }
    };

    const isLoading = isBudgetsLoading || isCategoriesLoading;
    if (isLoading) {
        return <div className="page-status">Loading budget data...</div>;
    }

    const displayError = budgetsError || categoriesError;
    if (budgetsError && budgets.length === 0 && categories.length === 0) {
        return <div className="page-status page-status-error">Error: {displayError}</div>;
    }

    return (
        <div className="budget-page-container">
            <h2>Monthly Budget Allocation (Expenses)</h2>
            <p className="section-subtitle">Enter a monthly budget for each expense category. Changes are saved automatically.</p>

            <div className="history-action-row">
                <button type="button" onClick={() => shiftSelectedMonth(-1)}>Previous</button>
                <input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} />
                <button type="button" onClick={() => shiftSelectedMonth(1)}>Next</button>
                <button type="button" onClick={rolloverFromPreviousMonth}>Rollover Previous Month</button>
            </div>
            {rolloverStatus && <p className="history-inline-status">{rolloverStatus}</p>}

            {displayError && !isLoading && (
                <p className="dashboard-warning-banner">Warning: {displayError}. Data may be incomplete.</p>
            )}

            <div className="budget-content-layout">
                <div className="budget-chart-column">
                    <div className="budget-chart-container">
                        {pieChartData ? (
                            <Pie data={pieChartData} options={chartOptions} />
                        ) : (
                            !isLoading && <p>No expense budgets set to display in chart.</p>
                        )}
                    </div>
                </div>

                <div className="budget-list-column">
                    <div className="budget-list">
                        {expenseBudgets.length === 0 && !isLoading ? (
                            <p className="empty-state-message">
                                No expense categories found. Add expense categories on the Dashboard first.
                            </p>
                        ) : (
                            expenseBudgets.map((budget) => {
                                const displayValue = budget.budget_amount_input !== undefined
                                    ? budget.budget_amount_input
                                    : (budget.budget_amount !== null ? budget.budget_amount.toFixed(2) : '0.00');

                                return (
                                    <div key={budget.id} className="budget-item">
                                        <label htmlFor={`budget-${budget.id}`} className="budget-item-label">{budget.name}</label>
                                        <div className="budget-item-input-group">
                                            <span className="currency-symbol">$</span>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                id={`budget-${budget.id}`}
                                                className="budget-item-input"
                                                value={displayValue}
                                                onChange={(event) => updateBudgetInput(budget.id, event.target.value)}
                                                onBlur={() => saveBudget(budget.id)}
                                                placeholder="0.00"
                                            />
                                            <span className={`budget-item-status status-${saveStatusByCategoryIdentifier[budget.id]?.status}`}>
                                                {saveStatusByCategoryIdentifier[budget.id]?.status === 'saving' && 'Saving...'}
                                                {saveStatusByCategoryIdentifier[budget.id]?.status === 'saved' && 'Saved'}
                                                {saveStatusByCategoryIdentifier[budget.id]?.status === 'error' && `Error: ${saveStatusByCategoryIdentifier[budget.id]?.message || 'Failed'}`}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default BudgetPage;