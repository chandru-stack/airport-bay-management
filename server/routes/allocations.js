const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');
const {
  allocateBay,
  detectConflict,
  suggestNextAvailableBay,
  reassignBay
} = require('../algorithms/bayAllocation');

// GET /api/allocations - Get all allocations
router.get('/', verifyToken, async (req, res) => {
  try {
    const { status, date, bay_id } = req.query;
    let query = `
      SELECT ba.*, f.flight_number, f.scheduled_arrival,
             f.scheduled_departure, f.status as flight_status,
             f.priority, b.bay_number, b.terminal, b.bay_type,
             a.name as airline_name, a.code as airline_code,
             ac.aircraft_type, ac.icao_size_code,
             u.name as allocated_by_name
      FROM bay_allocations ba
      JOIN flights f  ON ba.flight_id = f.id
      JOIN bays b     ON ba.bay_id    = b.id
      JOIN airlines a ON f.airline_id = a.id
      JOIN aircraft ac ON f.aircraft_id = ac.id
      LEFT JOIN users u ON ba.allocated_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND ba.status = $${params.length}`;
    }
    if (bay_id) {
      params.push(bay_id);
      query += ` AND ba.bay_id = $${params.length}`;
    }
    if (date) {
      params.push(date);
      query += ` AND DATE(ba.scheduled_arrival) = $${params.length}`;
    }

    query += ' ORDER BY ba.scheduled_arrival ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/allocations/auto - Auto allocate bay for a flight (AOCC only)
// POST /api/allocations/auto - Auto allocate bay for a flight (AOCC only)
router.post('/auto', verifyToken, requireRole('AOCC'), async (req, res) => {
  try {
    const { flight_id } = req.body;

    if (!flight_id) {
      return res.status(400).json({ message: 'flight_id is required' });
    }

    const result = await allocateBay(flight_id, req.user.id);

    if (!result.success) {
      if (result.conflict) {
        const suggestions = await suggestNextAvailableBay(flight_id);
        return res.status(409).json({
          message: result.message,
          suggestions: suggestions.suggestions || []
        });
      }
      return res.status(400).json({ message: result.message });
    }

    const io = req.app.get('io');
    io.emit('aocc:bay_assigned', {
      flight_id,
      bay: result.bay,
      allocation: result.allocation
    });

    const flightData = await pool.query(
      'SELECT * FROM flights WHERE id = $1', [flight_id]
    );

    await pool.query(`
      INSERT INTO notifications
        (user_id, type, title, body, flight_id, bay_id)
      SELECT u.id, 'BAY_ASSIGNED',
             'Bay Assigned - ' || $1,
             'Bay ' || $2 || ' has been assigned to your flight',
             $3, $4
      FROM users u
      JOIN airlines a ON u.airline_code = a.code
      WHERE a.id = $5
    `, [
      flightData.rows[0].flight_number,
      result.bay.bay_number,
      flight_id,
      result.bay.id,
      flightData.rows[0].airline_id
    ]);

    res.status(201).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/allocations/manual - Manually assign specific bay (AOCC only)
router.post('/manual', verifyToken, requireRole('AOCC'), async (req, res) => {
  try {
    const { flight_id, bay_id } = req.body;

    // Check conflict first
    const flightData = await pool.query(
      'SELECT * FROM flights WHERE id = $1', [flight_id]
    );
    if (flightData.rows.length === 0) {
      return res.status(404).json({ message: 'Flight not found' });
    }

    const flight = flightData.rows[0];
    const conflict = await detectConflict(
      bay_id,
      flight.scheduled_arrival,
      flight.scheduled_departure
    );

    if (conflict.hasConflict) {
      return res.status(409).json({
        message: 'Bay has a time conflict with another flight',
        conflicts: conflict.conflicts
      });
    }

    // Create manual allocation
    const allocation = await pool.query(`
      INSERT INTO bay_allocations
        (flight_id, bay_id, allocated_by, scheduled_arrival,
         scheduled_departure, allocation_type, status)
      VALUES ($1, $2, $3, $4, $5, 'MANUAL', 'ACTIVE')
      RETURNING *
    `, [
      flight_id, bay_id, req.user.id,
      flight.scheduled_arrival,
      flight.scheduled_departure
    ]);

    await pool.query(
      `UPDATE bays SET status = 'OCCUPIED', updated_at = NOW()
       WHERE id = $1`, [bay_id]
    );

    const bayData = await pool.query(
      'SELECT * FROM bays WHERE id = $1', [bay_id]
    );

    const io = req.app.get('io');
    io.emit('aocc:bay_assigned', {
      flight_id, bay: bayData.rows[0],
      allocation: allocation.rows[0]
    });

    res.status(201).json({
      success: true,
      allocation: allocation.rows[0],
      bay: bayData.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/allocations/reassign - Emergency reassign (AOCC only)
router.post('/reassign', verifyToken, requireRole('AOCC'), async (req, res) => {
  try {
    const { flight_id, new_bay_id, reason } = req.body;

    if (!flight_id || !new_bay_id || !reason) {
      return res.status(400).json({
        message: 'flight_id, new_bay_id and reason are required'
      });
    }

    const result = await reassignBay(
      flight_id, new_bay_id, req.user.id, reason
    );

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    const io = req.app.get('io');
    io.emit('aocc:bay_assigned', {
      flight_id,
      bay: result.bay,
      allocation: result.allocation,
      reassigned: true
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/allocations/conflict-check - Check conflict before assigning
router.get('/conflict-check', verifyToken, requireRole('AOCC'), async (req, res) => {
  try {
    const { bay_id, arrival, departure, exclude_flight_id } = req.query;

    const result = await detectConflict(
      bay_id, arrival, departure, exclude_flight_id
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;