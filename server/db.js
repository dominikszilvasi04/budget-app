// server/db.js
require('dotenv').config(); // Load environment variables from .env file
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost', // Use env variable or default
  user: process.env.DB_USER || 'root',      // Use env variable or default
  password: process.env.DB_PASSWORD,       // Use env variable (no default for password!)
  database: process.env.DB_NAME || 'budget_db', // Use env variable or default
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

pool.getConnection()
  .then(connection => {
    console.log('Successfully connected to the database (using env vars).');
    connection.release();
  })
  .catch(err => {
    console.error('Error connecting to the database:', err);
    // Provide more specific feedback if credentials might be wrong
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
        console.error('Check database username/password in your .env file.');
    } else if (err.code === 'ER_BAD_DB_ERROR') {
        console.error(`Database '${process.env.DB_NAME}' not found. Check DB_NAME in .env and ensure database exists.`);
    }
  });

module.exports = pool;