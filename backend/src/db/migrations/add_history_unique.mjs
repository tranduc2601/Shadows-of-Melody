import { pool } from '../../config/database.js';

// Deduplicate existing rows (keep the most recent per user+song)
await pool.query(`
  DELETE FROM listening_history a
  USING listening_history b
  WHERE a.id < b.id
    AND a.user_id = b.user_id
    AND a.song_id = b.song_id
`);

// Add unique constraint if not already present
const [rows] = await pool.query(`
  SELECT 1 FROM information_schema.table_constraints
  WHERE constraint_name = 'uq_history_user_song'
    AND table_name = 'listening_history'
`);

if (rows.length === 0) {
  await pool.query(`
    ALTER TABLE listening_history
    ADD CONSTRAINT uq_history_user_song UNIQUE (user_id, song_id)
  `);
  console.log('Constraint added.');
} else {
  console.log('Constraint already exists.');
}

await pool.end();
console.log('OK');
