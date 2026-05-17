-- v2: posts en tablones por zona del pueblo.
-- users, messages, presence ya existen y se reusan tal cual.
CREATE TABLE IF NOT EXISTS mm2_posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  zone       TEXT NOT NULL,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mm2_posts_zone_created ON mm2_posts(zone, created_at DESC);
