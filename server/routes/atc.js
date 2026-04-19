const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/atc/flights - ATC view of all active flights
router.get('/flights', verifyToken, requireRole('ATC', 'AOCC'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.*, a.name as airline_name, a.code as airline_code,
             ac.aircraft_type, ac.icao_size_code,
             b.bay_number, b.terminal, b.bay_type
      FROM flights f
      JOIN airlines a  ON f.airline_id  = a.id
      JOIN aircraft ac ON f.aircraft_id = ac.id
      LEFT JOIN bay_allocations ba ON ba.flight_id = f.id
        AND ba.status = 'ACTIVE'
      LEFT JOIN bays b ON ba.bay_id = b.id
      WHERE f.status NOT IN ('DEPARTED', 'CANCELLED')
      ORDER BY f.scheduled_arrival ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/atc/landing-notice - ATC sends 15min landing notice to AOCC
router.post('/landing-notice', verifyToken, requireRole('ATC'), async (req, res) => {
  try {
    const { flight_id, message_body } = req.body;

    // Check if bay already assigned
    const allocResult = await pool.query(
      `SELECT ba.*, b.bay_number FROM bay_allocations ba
       JOIN bays b ON ba.bay_id = b.id
       WHERE ba.flight_id = $1 AND ba.status = 'ACTIVE'`,
      [flight_id]
    );

    const bayAssigned = allocResult.rows.length > 0;
    const bayNumber   = bayAssigned ? allocResult.rows[0].bay_number : null;

    // Save ATC message
    const msgResult = await pool.query(`
      INSERT INTO atc_messages
        (flight_id, sent_by, message_type, message_body, bay_id)
      VALUES ($1, $2, 'LANDING_NOTICE_15MIN', $3, $4)
      RETURNING *
    `, [
      flight_id,
      req.user.id,
      message_body || 'Aircraft landing in 15 minutes. Bay confirmation required.',
      bayAssigned ? allocResult.rows[0].bay_id : null
    ]);

    // Update flight status to LANDING_SOON
    await pool.query(
      `UPDATE flights SET status = 'LANDING_SOON', updated_at = NOW()
       WHERE id = $1`, [flight_id]
    );

    // Notify AOCC in real time
    const io = req.app.get('io');
    io.emit('atc:landing_notice', {
      flight_id,
      bay_assigned: bayAssigned,
      bay_number:   bayNumber,
      message:      msgResult.rows[0]
    });

    res.json({
      message: 'Landing notice sent to AOCC',
      bay_assigned: bayAssigned,
      bay_number:   bayNumber,
      atc_message:  msgResult.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/atc/landed - ATC confirms aircraft has landed
router.post('/landed', verifyToken, requireRole('ATC'), async (req, res) => {
  try {
    const { flight_id, notes } = req.body;

    // Save landed confirmation message
    await pool.query(`
      INSERT INTO atc_messages
        (flight_id, sent_by, message_type, message_body)
      VALUES ($1, $2, 'LANDED_CONFIRMATION', $3)
    `, [flight_id, req.user.id,
        notes || 'Aircraft has landed successfully.']);

    // Update flight status
    await pool.query(
      `UPDATE flights SET status = 'LANDED',
       actual_arrival = NOW(), updated_at = NOW()
       WHERE id = $1`, [flight_id]
    );

    // Notify AOCC and Apron
    const io = req.app.get('io');
    io.emit('flight:landed', { flight_id, time: new Date() });

    res.json({ message: 'Landed confirmation sent to AOCC and Apron' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/atc/messages - Get all ATC messages
router.get('/messages', verifyToken, requireRole('ATC', 'AOCC'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT am.*, f.flight_number, u.name as sent_by_name,
             b.bay_number
      FROM atc_messages am
      JOIN flights f ON am.flight_id = f.id
      JOIN users u   ON am.sent_by   = u.id
      LEFT JOIN bays b ON am.bay_id  = b.id
      ORDER BY am.created_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/atc/messages/:id/acknowledge - AOCC acknowledges ATC message
router.patch('/messages/:id/acknowledge',
  verifyToken, requireRole('AOCC'), async (req, res) => {
  try {
    await pool.query(
      `UPDATE atc_messages SET is_acknowledged = true
       WHERE id = $1`, [req.params.id]
    );
    res.json({ message: 'Message acknowledged' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;