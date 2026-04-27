-- v2: separate account_name (login id) + display_name (public, mutable) + password_hash
-- Backfill: existing users get account_name = display_name = current username
-- Their password_hash stays NULL until they migrate via the "set password" prompt on next login.
-- They can keep using legacy X-Miau header until they migrate.

ALTER TABLE users ADD COLUMN account_name TEXT;
ALTER TABLE users ADD COLUMN display_name TEXT;
ALTER TABLE users ADD COLUMN password_hash TEXT;

UPDATE users SET account_name = username, display_name = username WHERE account_name IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_account_name ON users(account_name) WHERE account_name IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_display_lower ON users(LOWER(display_name)) WHERE display_name IS NOT NULL;
