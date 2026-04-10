-- Migration: add status column to songs table
-- status: 'published' (visible) | 'suppressed' (temporarily hidden)
ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'published'
  CHECK (status IN ('published', 'suppressed'));
