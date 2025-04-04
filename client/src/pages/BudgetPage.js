// client/src/pages/BudgetPage.js
import React, { useState, useEffect, useMemo, useCallback } from 'react'; // Ensure useMemo and useCallback are imported
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
     if (typeof value === 'number') return value;
     if (typeof value !== 'string') return NaN;
     if (value.trim() === '') return 0.00;
     const cleanedValue = value.replace(/[\$,]/g, '').trim();
     if (cleanedValue === '') return 0.00;
     const parsed = parseFloat(cleanedValue);
     return isNaN(parsed) || parsed < 0 ? NaN : parsed;
};

const generateChartColors = (numColors) => {
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
                    // Use context.raw for original value
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [savingStatus, setSavingStatus] = useState({});

    // --- Fetch Budget Data Effect ---
    const fetchBudgetData = useCallback(async (controller) => {
        setLoading(true); setError(null);
        try {
            const response = await axios.get('http://localhost:5001/api/budgets/current', { signal: controller?.signal });
            const initializedData = response.data.map(item => ({ ...item, budget_amount: item.budget_amount ?? 0.00 })); // Use nullish coalescing
            setBudgetData(initializedData);
        } catch (err) {
            if (!axios.isCancel(err)) { console.error("Error fetching budget data:", err); setError('Failed to load budget data.'); }
        } finally { if (!controller?.signal?.aborted) setLoading(false); }
    }, []); // Empty dependency array for useCallback

    useEffect(() => {
        const controller = new AbortController();
        fetchBudgetData(controller);
        return () => { controller.abort(); };
    }, [fetchBudgetData]); // Depend only on the memoized fetch function

    // --- *** MOVED pieChartData calculation HERE (Top Level of Component) *** ---
    const pieChartData = useMemo(() => {
        // Filter out categories with 0 or null/undefined budget amount
        const filteredData = budgetData.filter(item => item.budget_amount && item.budget_amount > 0);

        if (filteredData.length === 0) {
            return null; // Return null if no data to display
        }

        const labels = filteredData.map(item => item.name);
        const dataValues = filteredData.map(item => item.budget_amount);
        const backgroundColors = generateChartColors(filteredData.length);

        return {
            labels: labels,
            datasets: [
                {
                    label: 'Budget Amount',
                    data: dataValues, // Pass the raw numeric values
                    backgroundColor: backgroundColors,
                    borderColor: backgroundColors.map(color => color.replace('60%', '50%').replace('70%', '60%')),
                    borderWidth: 1,
                },
            ],
        };
    }, [budgetData]); // Recalculate only when budgetData changes


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
    if (loading) { // Check the combined or primary loading state
        return <div>Loading budget data...</div>;
    }
    if (error) { // Check for critical errors loading initial data
        return <div style={{ color: 'red', padding: '20px' }}>Error: {error}</div>;
    }
    // If no critical error, proceed to render the main content
    // Individual errors (like saving errors) are handled inline

    // --- Main Return Statement ---
    return (
        <div className="budget-page-container"> {/* Overall page container */}
            <h2>Monthly Budget Allocation</h2>
            <p>Enter the budget amount for each category for the current month. Changes save automatically when you click away.</p>

            {/* --- Layout Wrapper for Chart and List --- */}
            <div className="budget-content-layout">

                {/* --- Chart Section (Left Column) --- */}
                <div className="budget-chart-column">
                    <div className="budget-chart-container">
                        {/* Conditionally render chart or 'no data' message */}
                        {pieChartData ? (
                            <Pie data={pieChartData} options={chartOptions} />
                        ) : (
                            // Show message only if not loading (loading checked above)
                            <p>No budget amounts set to display in chart.</p>
                        )}
                    </div>
                </div>
                {/* --- End Chart Section --- */}


                {/* --- Budget Input List Section (Right Column) --- */}
                <div className="budget-list-column">
                    <div className="budget-list">
                        {/* Check if budgetData array is empty */}
                        {budgetData.length === 0 ? (
                            <p style={{ padding: '20px', fontStyle: 'italic', color: '#555' }}>
                                No categories found. Add categories on the Dashboard first.
                            </p>
                        ) : (
                            // Map over budgetData to render each category's input row
                            budgetData.map((item) => {
                                 // Determine the input value to display
                                 const displayValue = item.budget_amount_input !== undefined
                                    ? item.budget_amount_input
                                    : (item.budget_amount !== null ? item.budget_amount.toFixed(2) : '0.00');

                                return (
                                    <div key={item.id} className="budget-item">
                                        {/* Category Label */}
                                        <label htmlFor={`budget-${item.id}`} className="budget-item-label">
                                            {item.name}
                                        </label>
                                        {/* Input Group (Symbol + Input + Status) */}
                                        <div className="budget-item-input-group">
                                            <span className="currency-symbol">$</span>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                id={`budget-${item.id}`}
                                                className="budget-item-input"
                                                value={displayValue}
                                                onChange={(e) => handleBudgetChange(item.id, e.target.value)}
                                                onBlur={() => handleBudgetSave(item.id)} // Save on blur
                                                placeholder="0.00"
                                            />
                                            {/* Saving Status Indicator */}
                                            <span className={`budget-item-status status-${savingStatus[item.id]?.status}`}>
                                                {savingStatus[item.id]?.status === 'saving' && 'Saving...'}
                                                {savingStatus[item.id]?.status === 'saved' && 'Saved!'}
                                                {savingStatus[item.id]?.status === 'error' && `Error: ${savingStatus[item.id]?.message || 'Failed'}`}
                                            </span>
                                        </div> {/* End input group */}
                                    </div> // End budget item
                                );
                            }) // End map
                        )}
                    </div> {/* End budget-list */}
                </div>
                {/* --- End Budget Input List Section --- */}

            </div> {/* --- End budget-content-layout --- */}
        </div> // End budget-page-container
    );
} 

export default BudgetPage;