// client/src/App.js
import React from 'react';
// Import NavLink if you aren't already
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import './App.css';

// Import page components
import DashboardPage from './pages/DashboardPage';
import HistoryPage from './pages/HistoryPage';
import BudgetPage from './pages/BudgetPage'; // <-- Import the new page component
import GoalsPage from './pages/GoalsPage'; // <-- Import new page
function App() {
  return (
    <Router>
      <div className="App">
        {/* Shared Header */}
        <header className="App-header">
          <h1>Budget Tracker</h1>
          {/* Navigation Links */}
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
            {/* --- NEW Budget Link --- */}
            <NavLink
              to="/budget"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
                Budget
            </NavLink>
            <NavLink to="/goals" className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
                Goals
            </NavLink>
          </nav>
        </header>

        {/* Define Routes */}
        <main>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/history" element={<HistoryPage />} />
            {/* --- NEW Budget Route --- */}
            <Route path="/budget" element={<BudgetPage />} />
            {/* --- End NEW Budget Route --- */}
            {/* <Route path="*" element={<div>Page Not Found</div>} /> */}
            <Route path="/goals" element={<GoalsPage />} />
          </Routes>
        </main>

      </div>
    </Router>
  );
}

export default App;