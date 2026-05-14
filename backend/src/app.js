import express from 'express';
import cors from 'cors';
import config from './config/env.js';
import { testConnection, pool } from './config/database.js';
import { logger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimiter.js';


import authRoutes from './routes/auth.js';
import songRoutes from './routes/songs.js';
import artistRoutes from './routes/artists.js';
import albumRoutes from './routes/albums.js';
import playlistRoutes from './routes/playlists.js';
import favoriteRoutes from './routes/favorites.js';
import historyRoutes from './routes/history.js';
import streamRoutes from './routes/stream.js';
import subscriptionRoutes from './routes/subscriptions.js';
import adminRoutes from './routes/admin.js';
import roleRoutes from './routes/roles.js';
import studioRoutes from './routes/studio.js';

const app = express();


testConnection();


(async () => {
  const migrations = [
    `ALTER TABLE artists ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE SET NULL`,
    `ALTER TABLE artists ADD COLUMN IF NOT EXISTS cover_url VARCHAR(500)`,
    `ALTER TABLE albums   ALTER COLUMN artist_id DROP NOT NULL`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(50) DEFAULT 'momo'`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_label VARCHAR(50)`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) DEFAULT 0`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'VND'`,
    `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`,

    `CREATE UNIQUE INDEX IF NOT EXISTS artists_user_id_unique ON artists (user_id) WHERE user_id IS NOT NULL`,

    `CREATE TABLE IF NOT EXISTS artist_follows (
       user_id   INT NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
       artist_id INT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
       created_at TIMESTAMPTZ DEFAULT NOW(),
       PRIMARY KEY (user_id, artist_id)
     )`,
    `CREATE INDEX IF NOT EXISTS idx_artist_follows_artist ON artist_follows(artist_id)`,
    `CREATE INDEX IF NOT EXISTS idx_artist_follows_user   ON artist_follows(user_id)`,
  ];
  for (const sql of migrations) {
    try { await pool.query(sql); } catch (e) { console.warn('Auto-migration note:', e.message); }
  }


  try {
    await pool.query(
      `INSERT INTO artists (name, image_url, user_id)
       SELECT COALESCE(NULLIF(full_name, ''), username), avatar_url, id
       FROM users
       WHERE role = 'artist'
         AND deleted_at IS NULL
         AND id NOT IN (SELECT user_id FROM artists WHERE user_id IS NOT NULL)`
    );
  } catch (e) {
    console.warn('Artist backfill note:', e.message);
  }
})();


app.use(logger);
app.use(cors({
    origin: config.cors.origin,
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(generalLimiter);


app.use('/api/auth', authRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/artists', artistRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/studio', studioRoutes);


app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});


app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
    });
});


app.use(errorHandler);

export default app;
