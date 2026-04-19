const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');

// GET /api/apron/bays - Get all bays with current flight info (APRON view)
router.get('/bays', verifyToken, requireRole('APRON', 'AOCC'), async (req, res) => {
  try {
    const { terminal, status, date } = req.query;

    let query = `
      SELECT b.*,
        ba.id as allocation_id,
        ba.scheduled_arrival,
        ba.scheduled_departure,
        ba.actual_arrival,
        ba.actual_departure,
        f.id as flight_id,
        f.flight_number,
        f.status as flight_status,
        f.priority,
        a.name as airline_name,
        a.code as airline_code,
        ac.aircraft_type,
        ac.icao_size_code,
        ae_ob.event_time as on_block_time,
        ae_pb.event_time as pushback_time,
        ae_ofb.event_time as off_block_time
      FROM bays b
      LEFT JOIN bay_allocations ba ON ba.bay_id = b.id
        AND ba.status = 'ACTIVE'
      LEFT JOIN flights f ON ba.flight_id = f.id
      LEFT JOIN airlines a ON f.airline_id = a.id
      LEFT JOIN aircraft ac ON f.aircraft_id = ac.id
      LEFT JOIN apron_events ae_ob  ON ae_ob.bay_allocation_id  = ba.id
        AND ae_ob.event_type  = 'ON_BLOCK'
      LEFT JOIN apron_events ae_pb  ON ae_pb.bay_allocation_id  = ba.id
        AND ae_pb.event_type  = 'PUSHBACK'
      LEFT JOIN apron_events ae_ofb ON ae_ofb.bay_allocation_id = ba.id
        AND ae_ofb.event_type = 'OFF_BLOCK'
      WHERE b.is_active = true
    `;
    const params = [];

    if (terminal) {
      params.push(terminal);
      query += ` AND b.terminal = $${params.length}`;
    }
    if (status) {
      params.push(status);
      query += ` AND b.status = $${params.length}`;
    }

    query += ' ORDER BY b.terminal, b.bay_number';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/apron/on-block - Record ON-BLOCK event
router.post('/on-block', verifyToken, requireRole('APRON'), async (req, res) => {
  try {
    const { bay_allocation_id, notes } = req.body;

    const allocResult = await pool.query(
      `SELECT ba.*, b.id as bay_id, b.bay_number,
              f.flight_number, f.status as flight_status
       FROM bay_allocations ba
       JOIN bays b    ON ba.bay_id    = b.id
       JOIN flights f ON ba.flight_id = f.id
       WHERE ba.id = $1 AND ba.status = 'ACTIVE'`,
      [bay_allocation_id]
    );

    if (allocResult.rows.length === 0) {
      return res.status(404).json({ message: 'Active allocation not found' });
    }

    const alloc = allocResult.rows[0];

    // ✅ REAL WORLD CHECK: Aircraft must be LANDED before ON-BLOCK
    const allowedStatuses = ['LANDED', 'LANDING_SOON'];
    if (!allowedStatuses.includes(alloc.flight_status)) {
      return res.status(400).json({
        message: `Cannot record ON-BLOCK. Flight status is "${alloc.flight_status}". Aircraft must be LANDED first. ATC must confirm landing before Apron can record ON-BLOCK.`
      });
    }

    // Check if ON-BLOCK already recorded
    const existing = await pool.query(
      `SELECT * FROM apron_events
       WHERE bay_allocation_id = $1 AND event_type = 'ON_BLOCK'`,
      [bay_allocation_id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'ON-BLOCK already recorded for this flight' });
    }

    await pool.query(`
      INSERT INTO apron_events
        (bay_allocation_id, flight_id, event_type, recorded_by, notes)
      VALUES ($1, $2, 'ON_BLOCK', $3, $4)
    `, [bay_allocation_id, alloc.flight_id, req.user.id, notes || null]);

    await pool.query(
      `UPDATE bay_allocations SET actual_arrival = NOW()
       WHERE id = $1`, [bay_allocation_id]
    );

    await pool.query(
      `UPDATE flights SET status = 'ON_BLOCK', updated_at = NOW()
       WHERE id = $1`, [alloc.flight_id]
    );

    await pool.query(`
      INSERT INTO audit_logs
        (action_type, performed_by, role, flight_id, bay_id, new_value)
      VALUES ('ON_BLOCK_RECORDED', $1, 'APRON', $2, $3, $4)
    `, [req.user.id, alloc.flight_id, alloc.bay_id,
        JSON.stringify({ bay_number: alloc.bay_number })]);

    const io = req.app.get('io');
    io.emit('flight:on_block', {
      flight_id:     alloc.flight_id,
      flight_number: alloc.flight_number,
      bay_number:    alloc.bay_number,
      time:          new Date()
    });

    res.json({ message: `ON-BLOCK recorded for ${alloc.flight_number}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/apron/pushback - Record PUSHBACK event
router.post('/pushback', verifyToken, requireRole('APRON'), async (req, res) => {
  try {
    const { bay_allocation_id, notes } = req.body;

    const allocResult = await pool.query(
      `SELECT ba.*, b.id as bay_id, b.bay_number, f.flight_number
       FROM bay_allocations ba
       JOIN bays b ON ba.bay_id = b.id
       JOIN flights f ON ba.flight_id = f.id
       WHERE ba.id = $1 AND ba.status = 'ACTIVE'`,
      [bay_allocation_id]
    );

    if (allocResult.rows.length === 0) {
      return res.status(404).json({ message: 'Active allocation not found' });
    }

    const alloc = allocResult.rows[0];

    // Record PUSHBACK event
    await pool.query(`
      INSERT INTO apron_events
        (bay_allocation_id, flight_id, event_type, recorded_by, notes)
      VALUES ($1, $2, 'PUSHBACK', $3, $4)
    `, [bay_allocation_id, alloc.flight_id, req.user.id, notes || null]);

    // Update flight status
    await pool.query(
      `UPDATE flights SET status = 'PUSHBACK', updated_at = NOW()
       WHERE id = $1`, [alloc.flight_id]
    );

    // Audit log
    await pool.query(`
      INSERT INTO audit_logs
        (action_type, performed_by, role, flight_id, bay_id, new_value)
      VALUES ('PUSHBACK_RECORDED', $1, 'APRON', $2, $3, $4)
    `, [req.user.id, alloc.flight_id, alloc.bay_id,
        JSON.stringify({ bay_number: alloc.bay_number })]);

    const io = req.app.get('io');
    io.emit('flight:pushback', {
      flight_id:     alloc.flight_id,
      flight_number: alloc.flight_number,
      bay_number:    alloc.bay_number,
      time:          new Date()
    });

    res.json({ message: `PUSHBACK recorded for ${alloc.flight_number}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/apron/off-block - Record OFF-BLOCK event (flight departed bay)
router.post('/off-block', verifyToken, requireRole('APRON'), async (req, res) => {
  try {
    const { bay_allocation_id, notes } = req.body;

    const allocResult = await pool.query(
      `SELECT ba.*, b.id as bay_id, b.bay_number, f.flight_number
       FROM bay_allocations ba
       JOIN bays b ON ba.bay_id = b.id
       JOIN flights f ON ba.flight_id = f.id
       WHERE ba.id = $1 AND ba.status = 'ACTIVE'`,
      [bay_allocation_id]
    );

    if (allocResult.rows.length === 0) {
      return res.status(404).json({ message: 'Active allocation not found' });
    }

    const alloc = allocResult.rows[0];

    // Record OFF_BLOCK event
    await pool.query(`
      INSERT INTO apron_events
        (bay_allocation_id, flight_id, event_type, recorded_by, notes)
      VALUES ($1, $2, 'OFF_BLOCK', $3, $4)
    `, [bay_allocation_id, alloc.flight_id, req.user.id, notes || null]);

    // Update actual departure + complete allocation
    await pool.query(
      `UPDATE bay_allocations
       SET actual_departure = NOW(), status = 'COMPLETED', updated_at = NOW()
       WHERE id = $1`, [bay_allocation_id]
    );

    // Free the bay
    await pool.query(
      `UPDATE bays SET status = 'AVAILABLE', updated_at = NOW()
       WHERE id = $1`, [alloc.bay_id]
    );

    // Update flight status
    await pool.query(
      `UPDATE flights SET status = 'DEPARTED',
       actual_departure = NOW(), updated_at = NOW()
       WHERE id = $1`, [alloc.flight_id]
    );

    // Audit log
    await pool.query(`
      INSERT INTO audit_logs
        (action_type, performed_by, role, flight_id, bay_id, new_value)
      VALUES ('OFF_BLOCK_RECORDED', $1, 'APRON', $2, $3, $4)
    `, [req.user.id, alloc.flight_id, alloc.bay_id,
        JSON.stringify({ bay_number: alloc.bay_number })]);

    const io = req.app.get('io');
    io.emit('flight:off_block', {
      flight_id:     alloc.flight_id,
      flight_number: alloc.flight_number,
      bay_number:    alloc.bay_number,
      bay_id:        alloc.bay_id,
      time:          new Date()
    });

    res.json({ message: `OFF-BLOCK recorded. Bay ${alloc.bay_number} is now free.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/apron/history - Full apron event history with filters
router.get('/history', verifyToken, requireRole('APRON', 'AOCC'), async (req, res) => {
  try {
    const { bay_id, flight_number, date } = req.query;

    let query = `
      SELECT ae.*, f.flight_number, b.bay_number, b.terminal,
             a.name as airline_name, u.name as recorded_by_name
      FROM apron_events ae
      JOIN flights f  ON ae.flight_id = f.id
      JOIN bay_allocations ba ON ae.bay_allocation_id = ba.id
      JOIN bays b     ON ba.bay_id = b.id
      JOIN airlines a ON f.airline_id = a.id
      JOIN users u    ON ae.recorded_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (bay_id) {
      params.push(bay_id);
      query += ` AND b.id = $${params.length}`;
    }
    if (flight_number) {
      params.push(`%${flight_number}%`);
      query += ` AND f.flight_number ILIKE $${params.length}`;
    }
    if (date) {
      params.push(date);
      query += ` AND DATE(ae.event_time) = $${params.length}`;
    }

    query += ' ORDER BY ae.event_time DESC LIMIT 200';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;