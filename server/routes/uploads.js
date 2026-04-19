const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const csv      = require('csv-parser');
const fs       = require('fs');
const path     = require('path');
const pool     = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');

// Multer config — save CSV to uploads/
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' ||
        file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// POST /api/uploads/schedule - Upload flight schedule CSV
router.post('/schedule',
  verifyToken, requireRole('AIRLINE'),
  upload.single('schedule'),
  async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded' });
    }

    // Get airline id
    const airlineResult = await pool.query(
      'SELECT id FROM airlines WHERE code = $1',
      [req.user.airline_code]
    );
    if (airlineResult.rows.length === 0) {
      return res.status(404).json({ message: 'Airline not found' });
    }
    const airline_id = airlineResult.rows[0].id;

    // Create upload record
    const uploadRecord = await pool.query(`
      INSERT INTO schedule_uploads
        (airline_id, uploaded_by, file_name, file_path, upload_status)
      VALUES ($1, $2, $3, $4, 'PROCESSING')
      RETURNING *
    `, [airline_id, req.user.id,
        req.file.originalname, req.file.path]);

    const upload_id = uploadRecord.rows[0].id;
    const rows = [];

    // Parse CSV
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', async () => {
        let processed = 0;
        let failed    = 0;
        const errors  = [];

        for (const row of rows) {
          try {
            // Find aircraft by registration
            const acResult = await pool.query(
              'SELECT * FROM aircraft WHERE registration_number = $1',
              [row.aircraft_reg?.trim()]
            );
            if (acResult.rows.length === 0) {
              failed++;
              errors.push(`Row ${processed + failed}: Aircraft ${row.aircraft_reg} not found`);
              continue;
            }

            await pool.query(`
              INSERT INTO flights
                (flight_number, airline_id, aircraft_id, origin,
                 destination, scheduled_arrival, scheduled_departure,
                 terminal, priority, is_from_csv, schedule_upload_id,
                 created_by)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,$11)
              ON CONFLICT DO NOTHING
            `, [
              row.flight_number?.trim(),
              airline_id,
              acResult.rows[0].id,
              row.origin?.trim(),
              row.destination?.trim(),
              row.scheduled_arrival?.trim(),
              row.scheduled_departure?.trim(),
              row.terminal?.trim() || 'T1',
              row.priority?.trim() || 'NORMAL',
              upload_id,
              req.user.id
            ]);
            processed++;
          } catch (rowErr) {
            failed++;
            errors.push(`Row error: ${rowErr.message}`);
          }
        }

        // Update upload record
        await pool.query(`
          UPDATE schedule_uploads
          SET upload_status = 'DONE', total_flights = $1,
              processed_flights = $2, failed_flights = $3,
              error_log = $4, completed_at = NOW()
          WHERE id = $5
        `, [rows.length, processed, failed,
            errors.join('\n'), upload_id]);

        res.json({
          message:   'CSV processed successfully',
          total:     rows.length,
          processed,
          failed,
          errors
        });
      })
      .on('error', async (err) => {
        await pool.query(
          `UPDATE schedule_uploads
           SET upload_status = 'ERROR', error_log = $1
           WHERE id = $2`,
          [err.message, upload_id]
        );
        res.status(500).json({ message: 'CSV parse error', error: err.message });
      });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/uploads - Get upload history for airline
router.get('/', verifyToken, requireRole('AIRLINE', 'AOCC'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT su.*, u.name as uploaded_by_name, a.name as airline_name
      FROM schedule_uploads su
      JOIN users u    ON su.uploaded_by = u.id
      JOIN airlines a ON su.airline_id  = a.id
      ORDER BY su.created_at DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;