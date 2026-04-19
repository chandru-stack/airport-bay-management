const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/bays - Get all bays (all roles can view)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { terminal, status, bay_type } = req.query;
    let query = 'SELECT * FROM bays WHERE is_active = true';
    const params = [];

    if (terminal) {
      params.push(terminal);
      query += ` AND terminal = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    if (bay_type) {
      params.push(bay_type);
      query += ` AND bay_type = $${params.length}`;
    }

    query += ' ORDER BY terminal, bay_number';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/bays/:id - Get single bay with current allocation
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const bayResult = await pool.query(
      'SELECT * FROM bays WHERE id = $1', [id]
    );

    if (bayResult.rows.length === 0) {
      return res.status(404).json({ message: 'Bay not found' });
    }

    // Get current active allocation for this bay
    const allocResult = await pool.query(`
      SELECT ba.*, f.flight_number, f.status as flight_status,
             a.name as airline_name, a.code as airline_code,
             ac.aircraft_type, ac.icao_size_code
      FROM bay_allocations ba
      JOIN flights f ON ba.flight_id = f.id
      JOIN airlines a ON f.airline_id = a.id
      JOIN aircraft ac ON f.aircraft_id = ac.id
      WHERE ba.bay_id = $1 AND ba.status = 'ACTIVE'
      ORDER BY ba.created_at DESC LIMIT 1
    `, [id]);

    res.json({
      bay: bayResult.rows[0],
      current_allocation: allocResult.rows[0] || null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/bays/:id/status - Update bay status (AOCC and APRON only)
router.patch('/:id/status', verifyToken, requireRole('AOCC', 'APRON'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['AVAILABLE', 'OCCUPIED', 'BLOCKED', 'MAINTENANCE'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const result = await pool.query(
      `UPDATE bays SET status = $1, notes = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, notes || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Bay not found' });
    }

    // Log the action
    await pool.query(
      `INSERT INTO audit_logs (action_type, performed_by, role, bay_id, new_value)
       VALUES ($1, $2, $3, $4, $5)`,
      ['BAY_STATUS_UPDATED', req.user.id, req.user.role, id,
       JSON.stringify({ status, notes })]
    );

    // Emit real-time update
    const io = req.app.get('io');
    io.emit('bay:status_update', result.rows[0]);

    res.json({ message: 'Bay status updated', bay: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/bays/available/:icao_size/:terminal - Find available bays for aircraft
router.get('/available/:icao_size/:terminal', verifyToken, async (req, res) => {
  try {
    const { icao_size, terminal } = req.params;
    const { arrival, departure } = req.query;

    const result = await pool.query(`
      SELECT b.* FROM bays b
      WHERE b.is_active = true
        AND b.status = 'AVAILABLE'
        AND b.terminal = $1
        AND $2 = ANY(b.compatible_sizes)
        AND b.id NOT IN (
          SELECT ba.bay_id FROM bay_allocations ba
          WHERE ba.status = 'ACTIVE'
            AND (
              $3::timestamp < ba.scheduled_departure
              AND $4::timestamp > ba.scheduled_arrival
            )
        )
      ORDER BY b.bay_type DESC, b.bay_number
    `, [terminal, icao_size, arrival, departure]);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;