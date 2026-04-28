-- Story comments: lightweight DM-flavored replies on a story (sesión 11).
-- Comments expire alongside the story (we don't enforce, just stop showing once
-- the story is gone).

CREATE TABLE IF NOT EXISTS story_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    story_id  INTEGER NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    user_id   INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    content   TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_story_comments_story ON story_comments(story_id, created_at);
