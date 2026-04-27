-- v3: presence (who's online + where) + system_flags (kill switch / maintenance mode)
-- presence is upsert-heavy but tiny (1 row per user). Cleanup is by stale-read.

CREATE TABLE IF NOT EXISTS presence (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    zone TEXT,                  -- one of: tweets|posts|stories|chat|bereal|profile|plaza|null
    x INTEGER NOT NULL DEFAULT 640,
    y INTEGER NOT NULL DEFAULT 374,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_presence_updated ON presence(updated_at DESC);

CREATE TABLE IF NOT EXISTS system_flags (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Seed: maintenance off
INSERT OR IGNORE INTO system_flags (key, value) VALUES ('maintenance_mode', '0');
