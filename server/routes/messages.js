const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');

// GET /api/messages - Get messages for current user
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, u.name as from_name,
             f.flight_number
      FROM messages m
      JOIN users u ON m.from_user_id = u.id
      LEFT JOIN flights f ON m.flight_id = f.id
      WHERE m.to_user_id = $1
         OR m.to_role    = $2
      ORDER BY m.created_at DESC
      LIMIT 100
    `, [req.user.id, req.user.role]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/messages - Send a message
router.post('/', verifyToken, async (req, res) => {
  try {
    const { to_role, to_user_id, flight_id,
            subject, body, priority } = req.body;

    if (!body) {
      return res.status(400).json({ message: 'Message body is required' });
    }

    const result = await pool.query(`
      INSERT INTO messages
        (from_user_id, from_role, to_role, to_user_id,
         flight_id, subject, body, priority)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      req.user.id, req.user.role,
      to_role || null, to_user_id || null,
      flight_id || null, subject || null,
      body, priority || 'NORMAL'
    ]);

    const msg = result.rows[0];

    // Real-time emit
    const io = req.app.get('io');
    io.emit('message:new', {
      ...msg,
      from_name: req.user.name
    });

    res.status(201).json(msg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/messages/:id/read - Mark message as read
router.patch('/:id/read', verifyToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE messages SET is_read = true WHERE id = $1`,
      [req.params.id]
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;