-- ============================================================
-- Migration 001: Add role system
-- Run this against your PostgreSQL database.
-- ============================================================

-- 1. Create the role enum type (skip if already exists)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'artist', 'manager', 'admin');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add role column to users table (keep is_admin for dual-support)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'user';

-- 3. Back-fill: anyone who was is_admin=true gets role='admin'
UPDATE users SET role = 'admin' WHERE is_admin = TRUE AND role = 'user';

-- 4. Create role_requests table
CREATE TABLE IF NOT EXISTS role_requests (
    id          SERIAL PRIMARY KEY,
    user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by INT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_requests_user_id ON role_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_role_requests_status  ON role_requests(status);
