// Estado global mínimo + event emitter.
import type { PublicUser } from './api'

type Listener<T> = (v: T) => void

class Signal<T> {
  private listeners = new Set<Listener<T>>()
  constructor(private value: T) {}
  get(): T { return this.value }
  set(v: T): void { this.value = v; for (const l of this.listeners) l(v) }
  on(l: Listener<T>): () => void { this.listeners.add(l); return () => this.listeners.delete(l) }
}

export const me = new Signal<PublicUser | null>(null)
