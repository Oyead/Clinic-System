const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 10,                  
  idleTimeoutMillis: 30000, 
  connectionTimeoutMillis: 2000,
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Failed to connect to PostgreSQL container:', err.stack);
  } else {
    console.log('Connected to PostgreSQL database successfully!');
    release(); 
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};