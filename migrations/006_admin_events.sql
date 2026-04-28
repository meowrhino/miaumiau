-- Calendar events backed by DB so admins can edit without committing JSON (sesión 12).
-- public/data/events.json stays as a static fallback for when the table is empty.

CREATE TABLE IF NOT EXISTS admin_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date  TEXT NOT NULL,
    title TEXT NOT NULL,
    descr TEXT DEFAULT '',
    emoji TEXT DEFAULT '📅',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_events_date ON admin_events(date);
