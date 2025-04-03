// server/server.js
require('dotenv').config(); // Load .env variables first
const express = require('express');
const cors = require('cors');
const dbPool = require('./db');

const app = express();
// Use the PORT from .env, fallback to 5001 if not defined
const PORT = process.env.PORT || 5001;

// --- Middleware ---
app.use(cors()); // Allow requests from our frontend
app.use(express.json()); // Parse incoming JSON requests

// --- API Routes ---

// Basic test route (keep for now)
app.get('/', (req, res) => {
  res.send('Hello from Budget Tracker Backend!');
});

// GET all categories
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await dbPool.query('SELECT * FROM categories ORDER BY name'); // Get all categories, ordered by name
    res.json(rows); // Send the results back as JSON
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' }); // Send an error response
  }
});

// --- Start the server ---
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });