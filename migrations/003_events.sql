-- v4: events log (analytics — drives /admin/stats + city heatmap).
-- Append-only. user_id is nullable for anon page-views.
-- Storage budget: ~50 events/active-user/day. With ~100 users that's ~5k/day = ~150k/mo.
-- Far below D1 free tier (5M reads/day). Purge by cron after ~90 days.

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,                 -- NULL for anon
    kind TEXT NOT NULL,              -- e.g. 'view:section', 'create:tweet', 'enter:zone'
    props_json TEXT,                 -- arbitrary props blob; small JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_kind_created ON events(kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id, created_at DESC);
