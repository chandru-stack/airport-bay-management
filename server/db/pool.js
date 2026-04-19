const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        host:     'localhost',
        port:     5432,
        database: 'airport_bay_management',
        user:     'postgres',
        password: 'Chan2004@',
      }
);

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Connected to PostgreSQL');
    release();
  }
});

module.exports = pool;