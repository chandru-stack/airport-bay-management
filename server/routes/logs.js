const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/logs - Get audit history (all roles can see)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { flight_id, bay_id, role, date, action_type } = req.query;

    let query = `
      SELECT al.*, u.name as performed_by_name,
             f.flight_number, b.bay_number
      FROM audit_logs al
      LEFT JOIN users u   ON al.performed_by = u.id
      LEFT JOIN flights f ON al.flight_id    = f.id
      LEFT JOIN bays b    ON al.bay_id       = b.id
      WHERE 1=1
    `;
    const params = [];

    if (flight_id) {
      params.push(flight_id);
      query += ` AND al.flight_id = $${params.length}`;
    }
    if (bay_id) {
      params.push(bay_id);
      query += ` AND al.bay_id = $${params.length}`;
    }
    if (role) {
      params.push(role);
      query += ` AND al.role = $${params.length}`;
    }
    if (action_type) {
      params.push(`%${action_type}%`);
      query += ` AND al.action_type ILIKE $${params.length}`;
    }
    if (date) {
      params.push(date);
      query += ` AND DATE(al.created_at) = $${params.length}`;
    }

    query += ' ORDER BY al.created_at DESC LIMIT 200';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;