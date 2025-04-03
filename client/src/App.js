// client/src/App.js
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, NavLink } from 'react-router-dom'; // Import Router components, including NavLink
import './App.css'; // Keep global styles

// Import page components
import DashboardPage from './pages/DashboardPage';
import HistoryPage from './pages/HistoryPage';
// Optional Navigation component could be used instead of inline nav
// import Navigation from './components/Navigation';

function App() {
  return (
    <Router> {/* Wrap everything in BrowserRouter */}
      <div className="App">
        {/* Shared Header */}
        <header className="App-header">
          <h1>Budget Tracker</h1>
          {/* Navigation Links - Using NavLink for active styling */}
          <nav>
            {/* NavLink adds an 'active' class automatically */}
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
          </nav>
        </header>

        {/* Define Routes */}
        <main> {/* Wrap Routes in a main tag for semantics */}
          <Routes>
            {/* Route for the dashboard view */}
            {/* The exact prop ensures this only matches '/' */}
            <Route path="/" element={<DashboardPage />} />

            {/* Route for the transaction history view */}
            <Route path="/history" element={<HistoryPage />} />

            {/* Optional: Add a catch-all 404 route later */}
            {/* <Route path="*" element={<div>Page Not Found</div>} /> */}
          </Routes>
        </main>

      </div>
    </Router>
  );
}

export default App;