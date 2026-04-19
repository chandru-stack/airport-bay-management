const pool = require('../db/pool');

// ============================================================
// DELAY MONITOR — runs every 5 minutes
// Checks if any aircraft is occupying a bay beyond scheduled time
// ============================================================
const startDelayMonitor = (io) => {
  setInterval(async () => {
    try {
      // Find active allocations past scheduled departure by 15+ min
      const overdueFlights = await pool.query(`
        SELECT ba.*, f.flight_number, f.scheduled_departure,
               b.bay_number, a.name as airline_name
        FROM bay_allocations ba
        JOIN flights f  ON ba.flight_id = f.id
        JOIN bays b     ON ba.bay_id    = b.id
        JOIN airlines a ON f.airline_id = a.id
        WHERE ba.status = 'ACTIVE'
          AND f.status NOT IN ('DEPARTED','CANCELLED','OFF_BLOCK')
          AND f.scheduled_departure < NOW() - INTERVAL '15 minutes'
      `);

      for (const flight of overdueFlights.rows) {
        console.log(`⚠️  DELAY ALERT: ${flight.flight_number} overdue at bay ${flight.bay_number}`);

        // Emit delay alert to AOCC, ATC, Airline
        io.emit('aocc:delay_alert', {
          flight_id:    flight.flight_id,
          flight_number: flight.flight_number,
          bay_number:   flight.bay_number,
          airline:      flight.airline_name,
          overdue_since: flight.scheduled_departure,
          message:      `Flight ${flight.flight_number} is overdue at bay ${flight.bay_number}`
        });

        // Create notification for AOCC users
        await pool.query(`
          INSERT INTO notifications
            (user_id, type, title, body, flight_id, bay_id)
          SELECT id, 'DELAY_ALERT',
                 'Delay Alert: ' || $1,
                 'Flight ' || $1 || ' is overdue at bay ' || $2,
                 $3, $4
          FROM users WHERE role = 'AOCC'
        `, [
          flight.flight_number,
          flight.bay_number,
          flight.flight_id,
          flight.bay_id
        ]);
      }
    } catch (err) {
      console.error('Delay monitor error:', err.message);
    }
  }, 5 * 60 * 1000); // every 5 minutes

  console.log('⏱️  Delay monitor started (checks every 5 minutes)');
};

module.exports = { startDelayMonitor };