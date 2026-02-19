-- Manchengo ERP - Conflicts Table Migration
-- Version: 4
-- Description: Add _conflicts table for persisting sync conflict resolutions

CREATE TABLE IF NOT EXISTS _conflicts (
    id TEXT PRIMARY KEY,
    aggregate_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    local_event_id TEXT NOT NULL,
    remote_event_id TEXT NOT NULL,
    detected_at TEXT NOT NULL,
    resolved INTEGER NOT NULL DEFAULT 0,
    resolution_strategy TEXT,
    winning_event_id TEXT,
    resolved_at TEXT,
    resolved_by TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_conflicts_aggregate ON _conflicts(aggregate_type, aggregate_id);
CREATE INDEX idx_conflicts_resolved ON _conflicts(resolved);
