// server/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
// We don't need dbPool directly in server.js anymore for categories
// const dbPool = require('./db'); // Remove or comment out if only used for categories so far

// --- Import Routers ---
const categoryRoutes = require('./routes/categoryRoutes');
const transactionRoutes = require('./routes/transactionRoutes'); // <-- Import transaction routes

const app = express();
const PORT = process.env.PORT || 5001;


// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- API Routes ---

// Basic test route (optional)
app.get('/', (req, res) => {
  res.send('Hello from Budget Tracker Backend!');
});

// Mount the routers
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes); // <-- Mount transaction routes

// --- Error Handling Middleware ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send({ message: 'Something went wrong!' });
});

// --- Start the server ---
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // Optional: Verify DB connection (can be done in db.js as before)
  // dbPool.query('SELECT 1')
  //   .then(() => console.log('Database connection successful.'))
  //   .catch(err => console.error('Database connection failed:', err));
});