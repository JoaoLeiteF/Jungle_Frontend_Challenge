// One checkout attempt = one Idempotency-Key + the exact body sent with it. Kept in sessionStorage so a
// double click, a timeout retry or a page refresh replays the *same* attempt and recovers the same order.
import type { CreateOrderInput } from '@/api/contracts'
import { CHECKOUT_KEYS } from '@/api/storage'

const KEY = CHECKOUT_KEYS.attempt
const DRAFT = CHECKOUT_KEYS.draft

export interface Attempt {
  userId: string
  key: string
  body: CreateOrderInput
  orderId?: string
}

const read = <T>(k: string): T | null => {
  try {
    return JSON.parse(sessionStorage.getItem(k) ?? 'null') as T | null
  } catch {
    return null
  }
}
const write = (k: string, v: unknown) => {
  try {
    if (v === null) sessionStorage.removeItem(k)
    else sessionStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* private mode: the attempt still lives for this page */
  }
}

export const attempts = {
  get: (userId: string) => {
    const a = read<Attempt>(KEY)
    return a?.userId === userId ? a : null
  },
  /** Reuses the stored attempt when the body is identical; a different body means a new purchase intent. */
  forBody(userId: string, body: CreateOrderInput): Attempt {
    const current = attempts.get(userId)
    if (current && JSON.stringify(current.body) === JSON.stringify(body)) return current
    const next = { userId, key: crypto.randomUUID(), body }
    write(KEY, next)
    return next
  },
  setOrder(attempt: Attempt, orderId: string) {
    write(KEY, { ...attempt, orderId })
  },
  clear: () => write(KEY, null),
}

/** Form draft survives a session expiry → login → return to checkout, for the same user only. */
export const draft = {
  get<T>(userId: string): T | null {
    const saved = read<{ userId: string; value: T }>(DRAFT)
    if (saved && saved.userId !== userId) write(DRAFT, null)
    return saved?.userId === userId ? saved.value : null
  },
  set: (userId: string, value: unknown) => write(DRAFT, { userId, value }),
  clear: () => write(DRAFT, null),
}
