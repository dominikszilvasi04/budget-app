// client/src/pages/BudgetPage.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
// --- Chart.js Imports ---
import { Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    Title
} from 'chart.js';

// --- Register Chart.js components ---
ChartJS.register(ArcElement, Tooltip, Legend, Title);

// --- Helper Functions ---
const safeParseFloat = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return NaN;
    const cleanedValue = value.trim();
    if (cleanedValue === '') return NaN;
    const parsed = parseFloat(cleanedValue);
    return isNaN(parsed) ? NaN : parsed;
};

const formatCurrency = (num) => {
    const parsedNum = typeof num === 'number' ? num : safeParseFloat(num);
    if (isNaN(parsedNum)) { num = 0; } else { num = parsedNum; }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

const safeParseBudgetFloat = (value) => {
     if (typeof value === 'number') return value; // Allow 0 or positive
     if (typeof value !== 'string') return NaN;
     if (value.trim() === '') return 0.00; // Treat empty as 0
     const cleanedValue = value.replace(/[\$,]/g, '').trim();
     if (cleanedValue === '') return 0.00;
     const parsed = parseFloat(cleanedValue);
     return isNaN(parsed) || parsed < 0 ? NaN : parsed; // Disallow negative
};

const generateChartColors = (numColors) => { // Keep this if pieChartData uses it
    const colors = []; const baseHue = 200;
    for (let i = 0; i < numColors; i++) {
        const hue = (baseHue + (i * 40)) % 360; const saturation = 70 + (i % 3) * 10;
        const lightness = 60 + (i % 2) * 5; colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }
    return colors;
};


// --- Chart Options ---
const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
        legend: { position: 'top' },
        title: { display: true, text: 'Budget Allocation by Category (Current Month)', font: { size: 16 } },
        tooltip: {
            callbacks: {
                label: function(context) {
                    let label = context.label || ''; if (label) { label += ': '; }
                    if (context.raw !== null && context.raw !== undefined) { label += formatCurrency(context.raw); }
                    return label;
                }
            }
        }
    },
};

// --- Component Definition ---
function BudgetPage() {
    // --- State Variables ---
    const [budgetData, setBudgetData] = useState([]);
    const [loadingBudgets, setLoadingBudgets] = useState(true); // Specific loading state
    const [errorBudgets, setErrorBudgets] = useState(null); // Specific error state
    const [savingStatus, setSavingStatus] = useState({});
    const [categories, setCategories] = useState([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [errorCategories, setErrorCategories] = useState(null);

    // --- Fetch Budget Data Effect (CORRECTED Setters) ---
    const fetchBudgetData = useCallback(async (controller) => {
        // Use specific setters
        setLoadingBudgets(true);  // CORRECTED
        setErrorBudgets(null);    // CORRECTED
        try {
            const response = await axios.get('http://localhost:5001/api/budgets/current', { signal: controller?.signal });
            const initializedData = response.data.map(item => ({ ...item, budget_amount: item.budget_amount ?? 0.00 }));
            setBudgetData(initializedData);
        } catch (err) {
            if (!axios.isCancel(err)) {
                console.error("Error fetching budget data:", err);
                // Use specific setter
                setErrorBudgets('Failed to load budget data.'); // CORRECTED
            }
        } finally {
            if (!controller?.signal?.aborted) {
                // Use specific setter
                setLoadingBudgets(false); // CORRECTED
            }
        }
    }, []); // Empty dependency array for useCallback

    useEffect(() => {
        const controller = new AbortController();
        fetchBudgetData(controller);
        return () => { controller.abort(); };
    }, [fetchBudgetData]);

    // --- Fetch Categories Effect (Keep corrected version) ---
    useEffect(() => {
        const controller = new AbortController();
        const fetchCategories = async () => {
            setLoadingCategories(true); setErrorCategories(null);
            try {
                const response = await axios.get('http://localhost:5001/api/categories', { signal: controller.signal });
                setCategories(response.data);
            } catch (err) {
                 if (!axios.isCancel(err)) { console.error("Error fetching categories for budget page:", err); setErrorCategories('Failed to load category details.'); }
            } finally { if (!controller.signal.aborted) setLoadingCategories(false); }
        };
        fetchCategories();
        return () => controller.abort();
    }, []);

    // --- NEW: Memoized map for Category Types ---
    const categoryTypeMap = useMemo(() => {
        if (loadingCategories || !categories) return {}; // Wait for categories
        return categories.reduce((acc, cat) => {
            acc[cat.id] = cat.type; // Store type by category ID
            return acc;
        }, {});
    }, [categories, loadingCategories]); // Recalculate if categories change


    // --- NEW: Memoized Filtered Budget Data for Expenses ---
    const filteredExpenseBudgetData = useMemo(() => {
        // Wait for both budget and category data/types
        if (loadingBudgets || loadingCategories || !budgetData || !categories) {
            return [];
        }
        // Filter budgetData, keeping only items where the type is 'expense'
        return budgetData.filter(item => categoryTypeMap[item.id] === 'expense');
    }, [budgetData, categoryTypeMap, loadingBudgets, loadingCategories]); // Dependencies


    // --- MODIFIED: Prepare Data for Pie Chart (Using Filtered Data) ---
    const pieChartData = useMemo(() => {
        // Use the already filtered expense budget data
        if (loadingBudgets || loadingCategories || filteredExpenseBudgetData.length === 0) {
            return null; // No data or still loading
        }

        // Create a map of category ID to color
        const categoryColorMap = categories.reduce((acc, cat) => {
            acc[cat.id] = cat.color || '#CCCCCC'; return acc;
        }, {});

        // Further filter filteredExpenseBudgetData for amounts > 0
        const chartableData = filteredExpenseBudgetData.filter(item => item.budget_amount && item.budget_amount > 0);

        if (chartableData.length === 0) {
            return null; // No non-zero expense budgets set
        }

        const labels = chartableData.map(item => item.name);
        const dataValues = chartableData.map(item => item.budget_amount);
        const backgroundColors = chartableData.map(item => categoryColorMap[item.id] || '#CCCCCC');
        const borderColors = backgroundColors.map(color => { /* ... darker border logic ... */ });

        return {
            labels: labels,
            datasets: [{ label: 'Budget Amount', data: dataValues, backgroundColor: backgroundColors, borderColor: borderColors, borderWidth: 1, }],
        };
    // Recalculate when filtered data, categories, or loading states change
    }, [filteredExpenseBudgetData, categories, loadingBudgets, loadingCategories]);


    // --- Handle Input Change ---
    const handleBudgetChange = (categoryId, value) => {
        setBudgetData(currentData =>
            currentData.map(item =>
                item.id === categoryId ? { ...item, budget_amount_input: value } : item
            )
        );
        if (savingStatus[categoryId]) { setSavingStatus(prev => ({ ...prev, [categoryId]: null })); }
    };

    // --- Handle Saving Budget (onBlur) ---
    const handleBudgetSave = async (categoryId) => {
        const budgetItem = budgetData.find(item => item.id === categoryId);
        if (!budgetItem) return;

        const valueToSave = budgetItem.budget_amount_input !== undefined ? budgetItem.budget_amount_input : budgetItem.budget_amount;
        const parsedAmount = safeParseBudgetFloat(valueToSave);

        if (isNaN(parsedAmount)) {
             console.error("Invalid budget amount entered:", valueToSave);
             setSavingStatus(prev => ({ ...prev, [categoryId]: { status: 'error', message: 'Invalid number' } }));
             setTimeout(() => {
                 setBudgetData(currentData => currentData.map(item => item.id === categoryId ? { ...item, budget_amount_input: item.budget_amount?.toFixed(2) ?? '0.00' } : item ));
                 setSavingStatus(prev => ({ ...prev, [categoryId]: null }));
             }, 2000);
             return;
        }

        const storedAmount = budgetItem.budget_amount;
        if (parsedAmount === storedAmount) {
             if (budgetItem.budget_amount_input !== undefined) {
                 setBudgetData(currentData => currentData.map(item => item.id === categoryId ? { ...item, budget_amount_input: undefined } : item ));
             }
            console.log(`No change for category ${categoryId}`); return;
        }

        setSavingStatus(prev => ({ ...prev, [categoryId]: { status: 'saving' } }));
        try {
            const response = await axios.put('http://localhost:5001/api/budgets/set', { categoryId: categoryId, amount: parsedAmount });
            setBudgetData(currentData =>
                currentData.map(item =>
                    item.id === categoryId ? { ...item, budget_amount: response.data.budget.budget_amount, budget_amount_input: undefined } : item
                )
            );
            setSavingStatus(prev => ({ ...prev, [categoryId]: { status: 'saved' } }));
            setTimeout(() => setSavingStatus(prev => ({ ...prev, [categoryId]: null })), 2000);
        } catch (err) {
            console.error("Error saving budget:", err);
            let message = "Save failed"; if (err.response?.data?.message) message = err.response.data.message;
            setSavingStatus(prev => ({ ...prev, [categoryId]: { status: 'error', message } }));
            setTimeout(() => {
                 setBudgetData(currentData => currentData.map(item => item.id === categoryId ? { ...item, budget_amount_input: item.budget_amount?.toFixed(2) ?? '0.00' } : item ));
             }, 2000);
        }
    }; // End of handleBudgetSave


     // --- Render Logic ---
    // Update loading check
    const isLoading = loadingBudgets || loadingCategories; // Wait for both
    if (isLoading) { return <div>Loading budget data...</div>; }
    // Prioritize budget error, but mention category error too if present
    const displayError = errorBudgets || errorCategories;
    // Show critical error only if budgetData failed AND there's no category data to display list structure
    if (errorBudgets && budgetData.length === 0 && categories.length === 0) {
         return <div style={{ color: 'red', padding: '20px' }}>Error: {displayError}</div>;
    }


    // --- Main Return Statement ---
    return (
        <div className="budget-page-container">
            <h2>Monthly Budget Allocation (Expenses)</h2> {/* Updated Title */}
            <p>Enter the budget amount for each expense category for the current month. Changes save automatically.</p>

            {/* Optional: Display non-critical data loading error */}
            {displayError && !isLoading && <p style={{ color: 'orange', marginBottom: '15px' }}>Warning: {displayError}. Data may be incomplete.</p>}

            {/* Chart Section */}
            <div className="budget-content-layout">
                <div className="budget-chart-column">
                    <div className="budget-chart-container">
                        {pieChartData ? (
                            <Pie data={pieChartData} options={chartOptions} />
                        ) : (
                            !isLoading && <p>No expense budgets set to display in chart.</p> // Updated message
                        )}
                    </div>
                </div>

                {/* Budget Input List Section */}
                <div className="budget-list-column">
                    <div className="budget-list">
                        {/* Use FILTERED data for list and length check */}
                        {filteredExpenseBudgetData.length === 0 && !isLoading ? (
                            <p style={{ padding: '20px', fontStyle: 'italic', color: '#555' }}>
                                No expense categories found. Add expense categories on the Dashboard first.
                            </p>
                        ) : (
                            // Map over filteredExpenseBudgetData
                            filteredExpenseBudgetData.map((item) => {
                                const displayValue = item.budget_amount_input !== undefined ? item.budget_amount_input : (item.budget_amount !== null ? item.budget_amount.toFixed(2) : '0.00');
                                return (
                                    <div key={item.id} className="budget-item">
                                        <label htmlFor={`budget-${item.id}`} className="budget-item-label"> {item.name} </label>
                                        <div className="budget-item-input-group">
                                            <span className="currency-symbol">$</span>
                                            <input type="text" inputMode="decimal" id={`budget-${item.id}`} className="budget-item-input" value={displayValue} onChange={(e) => handleBudgetChange(item.id, e.target.value)} onBlur={() => handleBudgetSave(item.id)} placeholder="0.00" />
                                            <span className={`budget-item-status status-${savingStatus[item.id]?.status}`}>
                                                {/* Status messages */}
                                                {savingStatus[item.id]?.status === 'saving' && 'Saving...'}
                                                {savingStatus[item.id]?.status === 'saved' && 'Saved!'}
                                                {savingStatus[item.id]?.status === 'error' && `Error: ${savingStatus[item.id]?.message || 'Failed'}`}
                                            </span>
                                        </div>
                                    </div>
                                );
                            }) // End map
                        )}
                    </div> {/* End budget-list */}
                </div> {/* End budget-list-column */}
            </div> {/* End budget-content-layout */}
        </div> // End budget-page-container
    );
} // End BudgetPage Component

export default BudgetPage;