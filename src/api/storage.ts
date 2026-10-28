// Client-side persistence the app owns: the session token and the anonymous cart id.
// Everything else (cart contents, favorites…) lives behind the API.
const TOKEN_KEY = 'kurio.session'
const CART_KEY = 'kurio.cartId'

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export const storage = {
  getToken: () => safe(() => localStorage.getItem(TOKEN_KEY), null),
  setToken: (token: string | null) =>
    safe(() => (token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY)), undefined),
  getCartId: () =>
    safe(() => {
      let id = localStorage.getItem(CART_KEY)
      if (!id) {
        id = `guest_${crypto.randomUUID()}`
        localStorage.setItem(CART_KEY, id)
      }
      return id
    }, 'guest_ephemeral'),
  resetCartId: () => safe(() => localStorage.removeItem(CART_KEY), undefined),
}
