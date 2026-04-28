-- City waves: ephemeral "decir hola" events broadcast to all online players.
-- Only the last few seconds matter — older rows are discarded by the GET query
-- and cleaned up periodically.

CREATE TABLE IF NOT EXISTS city_waves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_city_waves_created ON city_waves(created_at DESC);
