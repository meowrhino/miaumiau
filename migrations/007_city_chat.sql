-- sesión 13: chat de proximidad en la ciudad.
-- Mensajes efímeros que se muestran como bocadillos sobre los avatares.
-- Se limpian solos (cleanup en cada POST + cron). No es historial: es ambiente.
CREATE TABLE IF NOT EXISTS city_chat (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    zone TEXT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_city_chat_created ON city_chat(created_at DESC);
