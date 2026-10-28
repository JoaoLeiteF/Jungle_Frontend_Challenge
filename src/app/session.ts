// Session store. Lives outside React so the router guards, the Axios 401 handler and the socket
// can all read and change it; components subscribe through useSession().
import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { setUnauthorizedHandler } from '@/api/client'
import type { ErrorCode, LoginInput, RegisterInput, Session, User } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { storage } from '@/api/storage'
import { queryClient, type Scope } from './query'

export type SessionState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null; expired?: boolean }
  | { status: 'authenticated'; user: User; token: string }

let state: SessionState = { status: 'loading', user: null }
const listeners = new Set<() => void>()
let ready: Promise<void> = Promise.resolve()

function set(next: SessionState) {
  state = next
  listeners.forEach((l) => l())
}

/** Drops every private query and its cache entries (logout, user switch, expiry). */
function clearPrivate() {
  queryClient.cancelQueries({ queryKey: ['u'] })
  queryClient.removeQueries({ queryKey: ['u'] })
  queryClient.removeQueries({ queryKey: ['guest'] })
}

async function adopt(session: Session) {
  const previous = state.status === 'authenticated' ? state.user.id : null
  if (previous && previous !== session.user.id) clearPrivate()
  storage.setToken(session.token)
  // Keep what the visitor put in the cart: merge the guest cart into the account, then start a fresh guest cart.
  const guestCartId = storage.getCartId()
  try {
    await api.cart.merge(guestCartId)
    storage.resetCartId()
  } catch {
    /* merge is best effort; the guest cart survives for a later attempt */
  }
  queryClient.removeQueries({ queryKey: ['guest'] })
  set({ status: 'authenticated', user: session.user, token: session.token })
}

export const session = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  /** Resolves once the boot-time session check is done (route guards await this). */
  ready: () => ready,

  boot() {
    const token = storage.getToken()
    if (!token) {
      set({ status: 'anonymous', user: null })
      return
    }
    ready = api.auth
      .session()
      .then((s) => set({ status: 'authenticated', user: s.user, token: s.token }))
      .catch(() => {
        storage.setToken(null)
        set({ status: 'anonymous', user: null })
      })
  },

  async login(input: LoginInput) {
    await adopt(await api.auth.login(input))
  },
  async register(input: RegisterInput) {
    await adopt(await api.auth.register(input))
  },
  async logout() {
    try {
      await api.auth.logout()
    } catch {
      /* the server session may already be gone; local logout must still happen */
    }
    storage.setToken(null)
    clearPrivate()
    set({ status: 'anonymous', user: null })
  },
  expire(code: ErrorCode) {
    if (state.status !== 'authenticated') return
    storage.setToken(null)
    clearPrivate()
    set({ status: 'anonymous', user: null, expired: true })
    toast.warning(code === 'SESSION_EXPIRED' ? 'Sua sessão expirou. Entre novamente para continuar.' : 'Faça login para continuar.')
  },
  updateUser(user: User) {
    if (state.status === 'authenticated') set({ ...state, user })
  },
}

setUnauthorizedHandler((code) => session.expire(code))

export function useSession() {
  return useSyncExternalStore(session.subscribe, session.get, session.get)
}

/** Query scope for the current visitor: the user id when logged in, the guest cart id otherwise. */
export function scopeOf(s: SessionState): Scope {
  return s.status === 'authenticated' ? ['u', s.user.id] : ['guest', storage.getCartId()]
}
export const useScope = () => scopeOf(useSession())
