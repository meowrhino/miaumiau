// Tipos compartidos para el API v2 (frontend importa los mismos shapes).
export interface PublicUser {
  id: number
  name: string          // display_name
  color: string
  avatar_seed: number
  bio: string
}

export interface BoardPost {
  id: number
  zone: string
  user: PublicUser
  content: string
  created_at: string
}

export interface DmMessage {
  id: number
  from_id: number
  to_id: number
  content: string
  created_at: string
}

export interface PresenceTick {
  others: Array<PublicUser & { x: number; y: number; updated_at: string }>
}

export const ZONES = ['plaza', 'cafe', 'tablon', 'miradero', 'polaroid', 'banquito'] as const
export type Zone = typeof ZONES[number]
