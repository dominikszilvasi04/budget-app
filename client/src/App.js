import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import './theme.css';

import DashboardPage from './pages/DashboardPage';
import HistoryPage from './pages/HistoryPage';
import BudgetPage from './pages/BudgetPage';
import GoalsPage from './pages/GoalsPage';
import InsightsPage from './pages/InsightsPage';
import RecurringPage from './pages/RecurringPage';
import ForecastPage from './pages/ForecastPage';

function App() {
  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <h1>Budget Tracker</h1>
          <nav>
            <NavLink
              to="/"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/history"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              Transaction History
            </NavLink>
            <NavLink
              to="/budget"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              Budget
            </NavLink>
            <NavLink
              to="/goals"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              Goals
            </NavLink>
            <NavLink
              to="/insights"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              Insights
            </NavLink>
            <NavLink
              to="/recurring"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              Recurring
            </NavLink>
            <NavLink
              to="/forecast"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              Forecast
            </NavLink>
          </nav>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/budget" element={<BudgetPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/recurring" element={<RecurringPage />} />
            <Route path="/forecast" element={<ForecastPage />} />
          </Routes>
        </main>

      </div>
    </Router>
  );
}

export default App;