const pool = require('../db/pool');

// ============================================================
// CORE BAY ALLOCATION ALGORITHM
// Chennai International Airport (MAA)
// ============================================================

const allocateBay = async (flightId, allocatedBy) => {
  try {
    // Step 1 — Get flight details
    const flightResult = await pool.query(`
      SELECT f.*, ac.icao_size_code, ac.aircraft_type,
             a.code as airline_code
      FROM flights f
      JOIN aircraft ac ON f.aircraft_id = ac.id
      JOIN airlines a  ON f.airline_id  = a.id
      WHERE f.id = $1
    `, [flightId]);

    if (flightResult.rows.length === 0) {
      return { success: false, message: 'Flight not found' };
    }

    const flight = flightResult.rows[0];

    console.log('🔍 Allocating bay for flight:', flight.flight_number,
      '| Terminal:', flight.terminal,
      '| Size:', flight.icao_size_code);

    // Step 2 — Check if bay already allocated
    const existingAlloc = await pool.query(
      `SELECT * FROM bay_allocations
       WHERE flight_id = $1 AND status = 'ACTIVE'`,
      [flightId]
    );
    if (existingAlloc.rows.length > 0) {
      return { success: false, message: 'Bay already allocated for this flight' };
    }

    // Step 3 — Find compatible available bays
    // Fix: cast icao_size properly for PostgreSQL array comparison
    const compatibleBays = await pool.query(`
      SELECT b.* FROM bays b
      WHERE b.is_active = true
        AND b.status != 'MAINTENANCE'
        AND b.status != 'BLOCKED'
        AND b.terminal = $1
        AND $2::icao_size = ANY(b.compatible_sizes)
        AND b.id NOT IN (
          SELECT ba.bay_id FROM bay_allocations ba
          WHERE ba.status = 'ACTIVE'
            AND ba.flight_id != $5
            AND (
              $3::timestamp < ba.scheduled_departure
              AND $4::timestamp > ba.scheduled_arrival
            )
        )
    `, [
      flight.terminal,
      flight.icao_size_code,
      flight.scheduled_arrival,
      flight.scheduled_departure,
      flightId
    ]);

    console.log('✅ Compatible bays found:', compatibleBays.rows.length);

    // Step 4 — If no bay found in assigned terminal,
    // try to find in ANY terminal (fallback)
    let baysToScore = compatibleBays.rows;

    if (baysToScore.length === 0) {
      console.log('⚠️  No bays in terminal', flight.terminal,
        '— trying all terminals...');

      const fallbackBays = await pool.query(`
        SELECT b.* FROM bays b
        WHERE b.is_active = true
          AND b.status != 'MAINTENANCE'
          AND b.status != 'BLOCKED'
          AND $1::icao_size = ANY(b.compatible_sizes)
          AND b.id NOT IN (
            SELECT ba.bay_id FROM bay_allocations ba
            WHERE ba.status = 'ACTIVE'
              AND ba.flight_id != $4
              AND (
                $2::timestamp < ba.scheduled_departure
                AND $3::timestamp > ba.scheduled_arrival
              )
          )
      `, [
        flight.icao_size_code,
        flight.scheduled_arrival,
        flight.scheduled_departure,
        flightId
      ]);

      console.log('🔄 Fallback bays found:', fallbackBays.rows.length);
      baysToScore = fallbackBays.rows;
    }

    if (baysToScore.length === 0) {
      return {
        success: false,
        message: `No compatible bay available for aircraft size ${flight.icao_size_code}. All bays are occupied or incompatible.`,
        conflict: true
      };
    }

    // Step 5 — Score each available bay
    const scoredBays = baysToScore.map(bay => {
      let score = 0;

      // Priority flight gets aerobridge preference
      if (flight.priority !== 'NORMAL' && bay.bay_type === 'AEROBRIDGE') {
        score += 100;
      }

      // Heavy/super heavy aircraft prefer aerobridge
      if (['E', 'F'].includes(flight.icao_size_code) &&
          bay.bay_type === 'AEROBRIDGE') {
        score += 50;
      }

      // Narrow body (C) prefer aerobridge
      if (flight.icao_size_code === 'C' && bay.bay_type === 'AEROBRIDGE') {
        score += 30;
      }

      // Prefer terminal match
      if (bay.terminal === flight.terminal) {
        score += 80;
      }

      // Prefer bays with exact size match
      const sizes = Array.isArray(bay.compatible_sizes)
        ? bay.compatible_sizes
        : [];
      if (sizes.length === 1) {
        score += 20;
      }

      // Prefer lower bay numbers (closer to terminal entrance)
      const bayNum = parseInt(bay.bay_number.split('-').pop()) || 99;
      score += Math.max(0, 50 - bayNum);

      return { ...bay, score };
    });

    // Sort by score descending
    scoredBays.sort((a, b) => b.score - a.score);
    const bestBay = scoredBays[0];

    console.log('🏆 Best bay selected:', bestBay.bay_number,
      '| Score:', bestBay.score);

    // Step 6 — Create allocation record
    const allocation = await pool.query(`
      INSERT INTO bay_allocations
        (flight_id, bay_id, allocated_by, scheduled_arrival,
         scheduled_departure, allocation_type, status)
      VALUES ($1, $2, $3, $4, $5, 'PRE_ALLOCATED', 'ACTIVE')
      RETURNING *
    `, [
      flightId,
      bestBay.id,
      allocatedBy,
      flight.scheduled_arrival,
      flight.scheduled_departure
    ]);

    // Step 7 — Update bay status to OCCUPIED
    await pool.query(
      `UPDATE bays SET status = 'OCCUPIED', updated_at = NOW()
       WHERE id = $1`,
      [bestBay.id]
    );

    // Step 8 — Audit log
    await pool.query(`
      INSERT INTO audit_logs
        (action_type, performed_by, role, flight_id, bay_id, new_value)
      VALUES ($1, $2, 'AOCC', $3, $4, $5)
    `, [
      'BAY_ALLOCATED',
      allocatedBy,
      flightId,
      bestBay.id,
      JSON.stringify({
        bay_number: bestBay.bay_number,
        score: bestBay.score
      })
    ]);

    return {
      success: true,
      allocation: allocation.rows[0],
      bay: bestBay,
      message: `Bay ${bestBay.bay_number} allocated successfully`
    };

  } catch (err) {
    console.error('Bay allocation error:', err);
    return {
      success: false,
      message: 'Allocation algorithm error: ' + err.message,
      error: err.message
    };
  }
};

// ============================================================
// CONFLICT DETECTION
// ============================================================
const detectConflict = async (
  bayId, arrivalTime, departureTime, excludeFlightId = null
) => {
  try {
    let query = `
      SELECT ba.*, f.flight_number,
             f.scheduled_arrival, f.scheduled_departure
      FROM bay_allocations ba
      JOIN flights f ON ba.flight_id = f.id
      WHERE ba.bay_id = $1
        AND ba.status = 'ACTIVE'
        AND (
          $2::timestamp < ba.scheduled_departure
          AND $3::timestamp > ba.scheduled_arrival
        )
    `;
    const params = [bayId, arrivalTime, departureTime];

    if (excludeFlightId) {
      params.push(excludeFlightId);
      query += ` AND ba.flight_id != $${params.length}`;
    }

    const result = await pool.query(query, params);
    return {
      hasConflict: result.rows.length > 0,
      conflicts: result.rows
    };
  } catch (err) {
    console.error('Conflict detection error:', err);
    return { hasConflict: false, conflicts: [] };
  }
};

// ============================================================
// SUGGEST NEXT AVAILABLE BAY
// ============================================================
const suggestNextAvailableBay = async (flightId) => {
  try {
    const flightResult = await pool.query(`
      SELECT f.*, ac.icao_size_code
      FROM flights f
      JOIN aircraft ac ON f.aircraft_id = ac.id
      WHERE f.id = $1
    `, [flightId]);

    if (flightResult.rows.length === 0) {
      return { success: false, message: 'Flight not found' };
    }

    const flight = flightResult.rows[0];

    const allBays = await pool.query(`
      SELECT b.*,
        (
          SELECT MIN(ba.scheduled_arrival)
          FROM bay_allocations ba
          WHERE ba.bay_id = b.id
            AND ba.status = 'ACTIVE'
            AND ba.scheduled_arrival > $2::timestamp
        ) as next_available_time
      FROM bays b
      WHERE b.is_active = true
        AND $1::icao_size = ANY(b.compatible_sizes)
        AND b.status != 'MAINTENANCE'
        AND b.status != 'BLOCKED'
      ORDER BY next_available_time ASC NULLS FIRST
      LIMIT 5
    `, [flight.icao_size_code, flight.scheduled_arrival]);

    return { success: true, suggestions: allBays.rows };
  } catch (err) {
    console.error('Suggest bay error:', err);
    return { success: false, message: 'Error finding suggestions' };
  }
};

// ============================================================
// RE-ASSIGN BAY (Emergency / Conflict override)
// ============================================================
const reassignBay = async (flightId, newBayId, reassignedBy, reason) => {
  try {
    const currentAlloc = await pool.query(
      `SELECT * FROM bay_allocations
       WHERE flight_id = $1 AND status = 'ACTIVE'`,
      [flightId]
    );

    const oldBayId = currentAlloc.rows[0]?.bay_id || null;

    if (currentAlloc.rows.length > 0) {
      await pool.query(
        `UPDATE bay_allocations SET status = 'CANCELLED', updated_at = NOW()
         WHERE flight_id = $1 AND status = 'ACTIVE'`,
        [flightId]
      );
      await pool.query(
        `UPDATE bays SET status = 'AVAILABLE', updated_at = NOW()
         WHERE id = $1`,
        [oldBayId]
      );
    }

    const flight = await pool.query(
      'SELECT * FROM flights WHERE id = $1', [flightId]
    );

    const newAlloc = await pool.query(`
      INSERT INTO bay_allocations
        (flight_id, bay_id, allocated_by, scheduled_arrival,
         scheduled_departure, allocation_type, status,
         conflict_reason, previous_bay_id)
      VALUES ($1, $2, $3, $4, $5, 'EMERGENCY', 'ACTIVE', $6, $7)
      RETURNING *
    `, [
      flightId, newBayId, reassignedBy,
      flight.rows[0].scheduled_arrival,
      flight.rows[0].scheduled_departure,
      reason, oldBayId
    ]);

    await pool.query(
      `UPDATE bays SET status = 'OCCUPIED', updated_at = NOW()
       WHERE id = $1`,
      [newBayId]
    );

    const bayDetails = await pool.query(
      'SELECT * FROM bays WHERE id = $1', [newBayId]
    );

    await pool.query(`
      INSERT INTO audit_logs
        (action_type, performed_by, role, flight_id, bay_id,
         old_value, new_value, reason)
      VALUES ($1, $2, 'AOCC', $3, $4, $5, $6, $7)
    `, [
      'BAY_REASSIGNED',
      reassignedBy,
      flightId,
      newBayId,
      JSON.stringify({ old_bay_id: oldBayId }),
      JSON.stringify({ new_bay_id: newBayId }),
      reason
    ]);

    return {
      success: true,
      allocation: newAlloc.rows[0],
      bay: bayDetails.rows[0],
      message: `Bay reassigned to ${bayDetails.rows[0].bay_number}`
    };

  } catch (err) {
    console.error('Reassign bay error:', err);
    return {
      success: false,
      message: 'Reassignment error',
      error: err.message
    };
  }
};

module.exports = {
  allocateBay,
  detectConflict,
  suggestNextAvailableBay,
  reassignBay
};