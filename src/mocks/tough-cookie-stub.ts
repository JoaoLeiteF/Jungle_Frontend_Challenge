// ponytail: MSW bundles tough-cookie (+ tldts, ~260 KB raw) only to emulate cookies on mocked
// responses. Kurio's simulated API is token-based and never sets cookies, so this no-op jar keeps the
// mock layer off the critical path (see ARCHITECTURE.md §10). If a handler ever needs Set-Cookie,
// drop the alias in vite.config.ts.
export class Cookie {
  static fromJSON() {
    return null
  }
}
export class MemoryCookieStore {
  idx: Record<string, unknown> = {}
}
export class CookieJar {
  getCookiesSync(): Cookie[] {
    return []
  }
  async setCookie() {}
}
export type SerializedCookie = Record<string, unknown>
export type MemoryCookieStoreIndex = Record<string, unknown>
