// server/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

// --- Import Routers ---
const categoryRoutes = require('./routes/categoryRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const budgetRoutes = require('./routes/budgetRoutes'); // <-- Import budget routes

const app = express();
const PORT = process.env.PORT || 5001;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- API Routes ---
app.get('/', (req, res) => { /* ... */ });

// Mount the routers
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes); // <-- Mount budget routes

// --- Error Handling Middleware ---
app.use((err, req, res, next) => { /* ... */ });

// --- Start the server ---
app.listen(PORT, () => { /* ... */ });