const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/flights - Get all flights
router.get('/', verifyToken, async (req, res) => {
  try {
    const { status, airline_id, terminal, date } = req.query;
    let query = `
      SELECT f.*, a.name as airline_name, a.code as airline_code,
             ac.aircraft_type, ac.icao_size_code, ac.registration_number,
             ba.id as allocation_id, b.bay_number, b.terminal as bay_terminal
      FROM flights f
      JOIN airlines a ON f.airline_id = a.id
      JOIN aircraft ac ON f.aircraft_id = ac.id
      LEFT JOIN bay_allocations ba ON ba.flight_id = f.id AND ba.status = 'ACTIVE'
      LEFT JOIN bays b ON ba.bay_id = b.id
      WHERE 1=1
    `;
    const params = [];

    // Airline users only see their own flights
    if (req.user.role === 'AIRLINE') {
      params.push(req.user.airline_code);
      query += ` AND a.code = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND f.status = $${params.length}`;
    }
    if (terminal) {
      params.push(terminal);
      query += ` AND f.terminal = $${params.length}`;
    }
    if (date) {
      params.push(date);
      query += ` AND DATE(f.scheduled_arrival) = $${params.length}`;
    }

    query += ' ORDER BY f.scheduled_arrival ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/flights/:id - Get single flight details
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.*, a.name as airline_name, a.code as airline_code,
             ac.aircraft_type, ac.icao_size_code, ac.registration_number,
             ba.id as allocation_id, b.bay_number, b.bay_type,
             b.terminal as bay_terminal
      FROM flights f
      JOIN airlines a ON f.airline_id = a.id
      JOIN aircraft ac ON f.aircraft_id = ac.id
      LEFT JOIN bay_allocations ba ON ba.flight_id = f.id AND ba.status = 'ACTIVE'
      LEFT JOIN bays b ON ba.bay_id = b.id
      WHERE f.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Flight not found' });
    }

    // Get services for this flight
    const services = await pool.query(
      'SELECT * FROM flight_services WHERE flight_id = $1',
      [req.params.id]
    );

    res.json({ ...result.rows[0], services: services.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/flights - Create new flight (AIRLINE only)
router.post('/', verifyToken, requireRole('AIRLINE', 'AOCC'), async (req, res) => {
  try {
    const {
      flight_number, aircraft_id, origin, destination,
      scheduled_arrival, scheduled_departure, terminal,
      priority, priority_reason, services
    } = req.body;

    // Get airline_id from aircraft
    const aircraftResult = await pool.query(
      'SELECT * FROM aircraft WHERE id = $1', [aircraft_id]
    );
    if (aircraftResult.rows.length === 0) {
      return res.status(404).json({ message: 'Aircraft not found' });
    }

    const airline_id = aircraftResult.rows[0].airline_id;

    const result = await pool.query(`
      INSERT INTO flights
        (flight_number, airline_id, aircraft_id, origin, destination,
         scheduled_arrival, scheduled_departure, terminal,
         priority, priority_reason, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `, [flight_number, airline_id, aircraft_id, origin, destination,
        scheduled_arrival, scheduled_departure, terminal,
        priority || 'NORMAL', priority_reason || null, req.user.id]);

    const flight = result.rows[0];

    // Insert services if provided
    if (services && services.length > 0) {
      for (const service of services) {
        await pool.query(
          'INSERT INTO flight_services (flight_id, service) VALUES ($1, $2)',
          [flight.id, service]
        );
      }
    }

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (action_type, performed_by, role, flight_id, new_value)
       VALUES ($1, $2, $3, $4, $5)`,
      ['FLIGHT_CREATED', req.user.id, req.user.role, flight.id,
       JSON.stringify(flight)]
    );

    // Notify AOCC
    const io = req.app.get('io');
    io.emit('flight:new', flight);

    res.status(201).json({ message: 'Flight created successfully', flight });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/flights/:id/status - Update flight status
router.patch('/:id/status', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE flights SET status = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Flight not found' });
    }

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (action_type, performed_by, role, flight_id, new_value)
       VALUES ($1, $2, $3, $4, $5)`,
      ['FLIGHT_STATUS_UPDATED', req.user.id, req.user.role, id,
       JSON.stringify({ status })]
    );

    const io = req.app.get('io');
    io.emit('flight:status_update', result.rows[0]);

    res.json({ message: 'Flight status updated', flight: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/aircraft - Get aircraft for logged in airline
router.get('/aircraft', verifyToken, async (req, res) => {
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