import express from 'express';
import cors from 'cors';
import config from './config/env.js';
import { testConnection, pool } from './config/database.js';
import { logger } from './middleware/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimiter.js';

// Routes
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

const app = express();

// Test database connection on startup
testConnection();

// ── Auto-run safe schema migrations ──────────────────────────────────────────
(async () => {
  const migrations = [
    `ALTER TABLE artists ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE SET NULL`,
    `ALTER TABLE albums   ALTER COLUMN artist_id DROP NOT NULL`,
  ];
  for (const sql of migrations) {
    try { await pool.query(sql); } catch (e) { console.warn('Auto-migration note:', e.message); }
  }
})();

// Middleware
app.use(logger);
app.use(cors({
    origin: config.cors.origin,
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(generalLimiter);

// Routes
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

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
    });
});

// Error handler (must be last)
app.use(errorHandler);

export default app;
