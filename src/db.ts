import type { User } from './middleware'

type DB = D1Database

// Public-facing alias: prefer display_name, fall back to legacy username.
// Existing client code reads `.username` everywhere — keep that field name in responses.
const NAME_ALIAS = `COALESCE(u.display_name, u.username) AS username`

// ─── Users ───

// v2 register: account_name (login), display_name (public), password_hash
// We also fill the legacy `username` column with account_name to satisfy the old NOT NULL+UNIQUE constraints
// without recreating the table. Future migration will drop it once all v1 users have migrated.
export const userCreateV2 = (db: DB, accountName: string, displayName: string, passwordHash: string, color: string, seed: number) =>
  db.prepare(`INSERT INTO users (username, account_name, display_name, password_hash, color, avatar_seed)
              VALUES (?, ?, ?, ?, ?, ?) RETURNING *`)
    .bind(accountName, accountName, displayName, passwordHash, color, seed).first<User>()

// Legacy v1 register (kept temporarily for rollback)
export const userCreate = (db: DB, username: string, trip: string, color: string, seed: number) =>
  db.prepare('INSERT INTO users (username, tripcode, account_name, display_name, color, avatar_seed) VALUES (?, ?, ?, ?, ?, ?) RETURNING *')
    .bind(username, trip, username, username, color, seed).first<User>()

// Lookup by *display_name* (case-insensitive) or fall back to legacy username
export const userGet = (db: DB, name: string) =>
  db.prepare(`SELECT * FROM users
              WHERE LOWER(display_name) = LOWER(?) OR username = ?
              LIMIT 1`).bind(name, name).first<User>()

export const userByAccountName = (db: DB, accountName: string) =>
  db.prepare('SELECT * FROM users WHERE account_name = ?').bind(accountName).first<User>()

export const userByDisplayName = (db: DB, displayName: string) =>
  db.prepare('SELECT * FROM users WHERE LOWER(display_name) = LOWER(?)').bind(displayName).first<User>()

export const userGetById = (db: DB, id: number) =>
  db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>()

export const userUpdate = (db: DB, id: number, color: string, theme: string, bio: string) =>
  db.prepare('UPDATE users SET color = ?, theme = ?, bio = ?, last_seen_at = datetime(\'now\') WHERE id = ? RETURNING *')
    .bind(color, theme, bio, id).first<User>()

export const userSetPassword = (db: DB, id: number, hash: string) =>
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, id).run()

export const userSetDisplayName = (db: DB, id: number, displayName: string) =>
  db.prepare('UPDATE users SET display_name = ? WHERE id = ?').bind(displayName, id).run()

export const userDelete = (db: DB, id: number) =>
  db.prepare('DELETE FROM users WHERE id = ?').bind(id).run()

export const userList = (db: DB) =>
  db.prepare(`SELECT id, COALESCE(display_name, username) AS username, color, avatar_seed, bio, created_at
              FROM users ORDER BY username`).all()

// ─── Tweets ───

export const tweetList = (db: DB, page: number, limit: number) =>
  db.prepare(`
    SELECT t.*, ${NAME_ALIAS}, u.color, u.avatar_seed,
      (SELECT COUNT(*) FROM tweets r WHERE r.parent_id = t.id) as reply_count
    FROM tweets t JOIN users u ON t.user_id = u.id
    WHERE t.parent_id IS NULL AND t.hidden = 0
    ORDER BY t.created_at DESC LIMIT ? OFFSET ?
  `).bind(limit, (page - 1) * limit).all()

export const tweetGet = (db: DB, id: number) =>
  db.prepare(`SELECT t.*, ${NAME_ALIAS}, u.color, u.avatar_seed
              FROM tweets t JOIN users u ON t.user_id = u.id WHERE t.id = ?`)
    .bind(id).first()

export const tweetReplies = (db: DB, parentId: number) =>
  db.prepare(`
    SELECT t.*, ${NAME_ALIAS}, u.color, u.avatar_seed
    FROM tweets t JOIN users u ON t.user_id = u.id
    WHERE t.parent_id = ? ORDER BY t.created_at ASC
  `).bind(parentId).all()

export const tweetCreate = (db: DB, userId: number, content: string, parentId: number | null) =>
  db.prepare('INSERT INTO tweets (user_id, content, parent_id) VALUES (?, ?, ?) RETURNING *')
    .bind(userId, content, parentId).first()

export const tweetReport = (db: DB, id: number) =>
  db.prepare('UPDATE tweets SET reports = reports + 1, hidden = CASE WHEN reports >= 4 THEN 1 ELSE hidden END WHERE id = ?')
    .bind(id).run()

// ─── Posts ───

export const postList = (db: DB, page: number, limit: number) =>
  db.prepare(`
    SELECT p.*, ${NAME_ALIAS}, u.color, u.avatar_seed,
      (SELECT COUNT(*) FROM post_comments c WHERE c.post_id = p.id) as comment_count
    FROM posts p JOIN users u ON p.user_id = u.id
    WHERE p.hidden = 0 ORDER BY p.created_at DESC LIMIT ? OFFSET ?
  `).bind(limit, (page - 1) * limit).all()

export const postGet = (db: DB, id: number) =>
  db.prepare(`SELECT p.*, ${NAME_ALIAS}, u.color, u.avatar_seed
              FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ?`)
    .bind(id).first()

export const postCreate = (db: DB, userId: number, caption: string, mediaKey: string) =>
  db.prepare('INSERT INTO posts (user_id, caption, media_key) VALUES (?, ?, ?) RETURNING *')
    .bind(userId, caption, mediaKey).first()

export const commentList = (db: DB, postId: number) =>
  db.prepare(`
    SELECT c.*, ${NAME_ALIAS}, u.color, u.avatar_seed
    FROM post_comments c JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ? ORDER BY c.created_at ASC
  `).bind(postId).all()

export const commentCreate = (db: DB, postId: number, userId: number, content: string) =>
  db.prepare('INSERT INTO post_comments (post_id, user_id, content) VALUES (?, ?, ?) RETURNING *')
    .bind(postId, userId, content).first()

// ─── Reactions ───

export async function reactionToggle(db: DB, userId: number, targetType: string, targetId: number, emoji: string) {
  const existing = await db.prepare(
    'SELECT id FROM reactions WHERE user_id = ? AND target_type = ? AND target_id = ?'
  ).bind(userId, targetType, targetId).first<{ id: number }>()
  if (existing) {
    await db.prepare('DELETE FROM reactions WHERE id = ?').bind(existing.id).run()
    return null
  }
  return db.prepare('INSERT INTO reactions (user_id, target_type, target_id, emoji) VALUES (?, ?, ?, ?) RETURNING *')
    .bind(userId, targetType, targetId, emoji).first()
}

export const reactionCounts = (db: DB, targetType: string, targetId: number) =>
  db.prepare('SELECT emoji, COUNT(*) as count FROM reactions WHERE target_type = ? AND target_id = ? GROUP BY emoji')
    .bind(targetType, targetId).all()

// ─── Stories ───

export const storyList = (db: DB) =>
  db.prepare(`
    SELECT s.*, ${NAME_ALIAS}, u.color, u.avatar_seed
    FROM stories s JOIN users u ON s.user_id = u.id
    WHERE s.expires_at > datetime('now')
    ORDER BY s.created_at DESC
  `).all()

export const storyCreate = (db: DB, userId: number, mediaKey: string, layersJson: string, expiresAt: string) =>
  db.prepare('INSERT INTO stories (user_id, media_key, layers_json, expires_at) VALUES (?, ?, ?, ?) RETURNING *')
    .bind(userId, mediaKey, layersJson, expiresAt).first()

export const storyView = (db: DB, storyId: number, userId: number) =>
  db.prepare('INSERT OR IGNORE INTO story_views (story_id, user_id) VALUES (?, ?)').bind(storyId, userId).run()

export async function storyCleanup(db: DB, storage: R2Bucket) {
  const expired = await db.prepare("SELECT media_key FROM stories WHERE expires_at <= datetime('now')").all<{ media_key: string }>()
  for (const { media_key } of expired.results) {
    await storage.delete('media/stories/' + media_key)
  }
  await db.prepare("DELETE FROM story_views WHERE story_id NOT IN (SELECT id FROM stories WHERE expires_at > datetime('now'))").run()
  await db.prepare("DELETE FROM stories WHERE expires_at <= datetime('now')").run()
}

// ─── Chat ───

export const conversationList = (db: DB, userId: number) =>
  db.prepare(`
    SELECT c.*,
      CASE WHEN c.user_a = ? THEN COALESCE(ub.display_name, ub.username) ELSE COALESCE(ua.display_name, ua.username) END as other_username,
      CASE WHEN c.user_a = ? THEN ub.color ELSE ua.color END as other_color,
      CASE WHEN c.user_a = ? THEN ub.avatar_seed ELSE ua.avatar_seed END as other_avatar_seed,
      CASE WHEN c.user_a = ? THEN c.user_b ELSE c.user_a END as other_id
    FROM conversations c
    JOIN users ua ON c.user_a = ua.id
    JOIN users ub ON c.user_b = ub.id
    WHERE c.user_a = ? OR c.user_b = ?
    ORDER BY c.last_message_at DESC
  `).bind(userId, userId, userId, userId, userId, userId).all()

export const messageList = (db: DB, userA: number, userB: number, before: number | null, limit: number) =>
  db.prepare(`
    SELECT m.*, ${NAME_ALIAS}, u.color, u.avatar_seed
    FROM messages m JOIN users u ON m.sender_id = u.id
    WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
    ${before ? 'AND m.id < ?' : ''}
    ORDER BY m.created_at DESC LIMIT ?
  `).bind(...(before ? [userA, userB, userB, userA, before, limit] : [userA, userB, userB, userA, limit])).all()

export async function messageCreate(db: DB, senderId: number, receiverId: number, content: string, mediaKey: string | null) {
  const msg = await db.prepare('INSERT INTO messages (sender_id, receiver_id, content, media_key) VALUES (?, ?, ?, ?) RETURNING *')
    .bind(senderId, receiverId, content, mediaKey).first()
  const preview = content.slice(0, 50)
  const [a, b] = senderId < receiverId ? [senderId, receiverId] : [receiverId, senderId]
  await db.prepare(`
    INSERT INTO conversations (user_a, user_b, last_message_at, last_message_preview) VALUES (?, ?, datetime('now'), ?)
    ON CONFLICT(user_a, user_b) DO UPDATE SET last_message_at = datetime('now'), last_message_preview = ?
  `).bind(a, b, preview, preview).run()
  return msg
}

export const messageMarkRead = (db: DB, receiverId: number, senderId: number) =>
  db.prepare("UPDATE messages SET read_at = datetime('now') WHERE receiver_id = ? AND sender_id = ? AND read_at IS NULL")
    .bind(receiverId, senderId).run()

export const messagePoll = (db: DB, userId: number, since: string) =>
  db.prepare(`
    SELECT m.*, ${NAME_ALIAS}, u.color, u.avatar_seed
    FROM messages m JOIN users u ON m.sender_id = u.id
    WHERE m.receiver_id = ? AND m.created_at > ?
    ORDER BY m.created_at ASC
  `).bind(userId, since).all()

export const unreadCount = (db: DB, userId: number) =>
  db.prepare('SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND read_at IS NULL')
    .bind(userId).first<{ count: number }>()

// ─── Presence (city) ───

export const presenceUpsert = (db: DB, userId: number, zone: string | null, x: number, y: number) =>
  db.prepare(`
    INSERT INTO presence (user_id, zone, x, y, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      zone = excluded.zone,
      x = excluded.x,
      y = excluded.y,
      updated_at = datetime('now')
  `).bind(userId, zone, x, y).run()

// Returns users active in last `secondsActive` seconds, with display name + color + avatar_seed for rendering.
export const presenceList = (db: DB, secondsActive: number = 90) =>
  db.prepare(`
    SELECT p.user_id, p.zone, p.x, p.y, p.updated_at,
      COALESCE(u.display_name, u.username) AS username,
      u.color, u.avatar_seed
    FROM presence p JOIN users u ON p.user_id = u.id
    WHERE p.updated_at > datetime('now', '-' || ? || ' seconds')
    ORDER BY p.updated_at DESC
    LIMIT 200
  `).bind(secondsActive).all()

export const presenceClear = (db: DB, userId: number) =>
  db.prepare('DELETE FROM presence WHERE user_id = ?').bind(userId).run()

// ─── System flags (maintenance kill switch) ───

export const flagGet = (db: DB, key: string) =>
  db.prepare('SELECT value FROM system_flags WHERE key = ?').bind(key).first<{ value: string }>()

export const flagSet = (db: DB, key: string, value: string) =>
  db.prepare(`
    INSERT INTO system_flags (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `).bind(key, value).run()
