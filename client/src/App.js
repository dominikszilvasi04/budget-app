import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import './theme.css';

import DashboardPage from './pages/DashboardPage';
import HistoryPage from './pages/HistoryPage';
import BudgetPage from './pages/BudgetPage';
import GoalsPage from './pages/GoalsPage';

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
          </nav>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/budget" element={<BudgetPage />} />
            <Route path="/goals" element={<GoalsPage />} />
          </Routes>
        </main>

      </div>
    </Router>
  );
}

export default App;