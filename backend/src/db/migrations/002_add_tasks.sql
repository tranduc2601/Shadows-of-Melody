-- Migration 002: Manager tasks table
-- Run once: psql -d <db_name> -f 002_add_tasks.sql

CREATE TABLE IF NOT EXISTS manager_tasks (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(200)  NOT NULL,
    description TEXT,
    assigned_to INT           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by INT           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status      VARCHAR(20)   NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'in_progress', 'completed')),
    created_at  TIMESTAMPTZ   DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON manager_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status       ON manager_tasks(status);
