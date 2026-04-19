require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'budget_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

pool.getConnection()
  .then((connection) => {
    console.log('Successfully connected to the database (using env vars).');
    connection.release();
  })
  .catch((error) => {
    console.error('Error connecting to the database:', error);
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
        console.error('Check database username/password in your .env file.');
    } else if (error.code === 'ER_BAD_DB_ERROR') {
        console.error(`Database '${process.env.DB_NAME}' not found. Check DB_NAME in .env and ensure database exists.`);
    }
  });

module.exports = pool;