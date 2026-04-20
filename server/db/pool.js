const { Pool } = require('pg');
const dns = require('dns');

// Force IPv4 DNS resolution
dns.setDefaultResultOrder('ipv4first');

let poolConfig;

if (process.env.DATABASE_URL) {
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  };
} else {
  poolConfig = {
    host:     'localhost',
    port:     5432,
    database: 'airport_bay_management',
    user:     'postgres',
    password: 'Chan2004@',
  };
}

const pool = new Pool(poolConfig);

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Connected to PostgreSQL');
    release();
  }
});

module.exports = pool;