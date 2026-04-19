const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { verifyToken } = require('../middleware/auth');

// GET /api/notifications - Get notifications for current user
router.get('/', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT n.*, f.flight_number, b.bay_number
      FROM notifications n
      LEFT JOIN flights f ON n.flight_id = f.id
      LEFT JOIN bays b    ON n.bay_id    = b.id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT 50
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/notifications/:id/read - Mark as read
router.patch('/:id/read', verifyToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE id = $1`,
      [req.params.id]
    );
    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/notifications/read-all - Mark all as read
router.patch('/read-all', verifyToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1`,
      [req.user.id]
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;