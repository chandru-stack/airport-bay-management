const express = require('express');
const router  = express.Router();
const pool    = require('../db/pool');
const { verifyToken } = require('../middleware/auth');

// GET /api/aircraft
router.get('/', verifyToken, async (req, res) => {
  try {
    let query = `
      SELECT ac.*, a.name as airline_name, a.code as airline_code
      FROM aircraft ac
      JOIN airlines a ON ac.airline_id = a.id
      WHERE ac.is_active = true
    `;
    const params = [];

    if (req.user.role === 'AIRLINE') {
      params.push(req.user.airline_code);
      query += ` AND a.code = $1`;
    }

    query += ' ORDER BY ac.registration_number';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;