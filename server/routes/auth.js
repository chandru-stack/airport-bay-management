const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/pool');

const JWT_SECRET  = 'airport_bay_maa_secret_key_2025';
const JWT_EXPIRES = '8h';

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    const token = jwt.sign(
      {
        id:           user.id,
        name:         user.name,
        email:        user.email,
        role:         user.role,
        airline_code: user.airline_code
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id:           user.id,
        name:         user.name,
        email:        user.email,
        role:         user.role,
        airline_code: user.airline_code
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'No token.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const result  = await pool.query(
      'SELECT id, name, email, role, airline_code, last_login FROM users WHERE id = $1',
      [decoded.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(403).json({ message: 'Invalid token.' });
  }
});

module.exports = router;