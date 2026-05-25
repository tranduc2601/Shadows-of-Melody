import { pool } from '../src/config/database.js';

const statements = [
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) NOT NULL DEFAULT 'local'",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(100)",
  "CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_key ON users (google_id)",
  "CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id)",
  "CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users (auth_provider)",
  "UPDATE users SET auth_provider = COALESCE(auth_provider, 'local') WHERE auth_provider IS NULL",
];

try {
  for (const stmt of statements) {
    await pool.query(stmt);
    console.log(`Executed: ${stmt}`);
  }
  console.log('Google auth migration completed');
} catch (error) {
  console.error('Google auth migration failed:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
