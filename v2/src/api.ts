// Wrapper de fetch para la API v2. Todo pasa cookie de sesión (HttpOnly).
import { API_BASE } from './config'
import type { Zone } from './config'

export interface PublicUser {
  id: number; name: string; color: string; avatar_seed: number; bio: string
}
export interface BoardPost {
  id: number; zone: string; user: PublicUser; content: string; created_at: string
}
export interface DmMessage {
  id: number; from_id: number; to_id: number; content: string; created_at: string
}
export interface PresenceOther extends PublicUser {
  x: number; y: number; updated_at: string
}

class ApiError extends Error {
  constructor(public status: number, msg: string) { super(msg) }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API_BASE + path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, (body as any)?.error ?? `error ${res.status}`)
  return body as T
}

export const api = {
  ApiError,

  register: (name: string, password: string) =>
    call<PublicUser>('/auth/register', { method: 'POST', body: JSON.stringify({ name, password }) }),
  login: (name: string, password: string) =>
    call<{ id: number; name: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ name, password }) }),
  logout: () => call<{ ok: true }>('/auth/logout', { method: 'POST' }),

  me: () => call<PublicUser>('/me'),
  updateMe: (patch: Partial<{ color: string; bio: string; avatar_seed: number }>) =>
    call<{ ok: true }>('/me', { method: 'PATCH', body: JSON.stringify(patch) }),

  getUser: (id: number) => call<PublicUser>(`/users/${id}`),

  listBoard: (zone: Zone) => call<{ posts: BoardPost[] }>(`/boards/${zone}`),
  postBoard: (zone: Zone, content: string) =>
    call<BoardPost>(`/boards/${zone}`, { method: 'POST', body: JSON.stringify({ content }) }),

  listDm: (userId: number) => call<{ messages: DmMessage[] }>(`/dm/${userId}`),
  sendDm: (userId: number, content: string) =>
    call<DmMessage>(`/dm/${userId}`, { method: 'POST', body: JSON.stringify({ content }) }),

  presence: (x: number, y: number, zone: string | null) =>
    call<{ others: PresenceOther[] }>('/presence', { method: 'POST', body: JSON.stringify({ x, y, zone }) }),
}
