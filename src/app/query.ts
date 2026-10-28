import { QueryClient } from '@tanstack/react-query'
import type { CatalogQuery } from '@/api/contracts'
import { isApiError } from '@/api/client'

/**
 * Keys are scoped: public data under ['nfts'], private data under ['u', userId], guest data under
 * ['guest', cartId]. Logout/user switch removes ['u'] wholesale, so nothing leaks between users.
 */
export type Scope = readonly ['u', string] | readonly ['guest', string]
export const qk = {
  catalog: (q: CatalogQuery) => ['nfts', 'list', q] as const,
  catalogAll: ['nfts', 'list'] as const,
  nft: (id: string) => ['nfts', 'detail', id] as const,
  cart: (scope: Scope) => [...scope, 'cart'] as const,
  quote: (scope: Scope) => [...scope, 'quote'] as const,
  favorites: (userId: string) => ['u', userId, 'favorites'] as const,
  orders: (userId: string) => ['u', userId, 'orders'] as const,
  order: (userId: string, id: string) => ['u', userId, 'orders', id] as const,
  me: (userId: string) => ['u', userId, 'me'] as const,
  wallets: (userId: string) => ['u', userId, 'wallets'] as const,
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // Retry only what can succeed on a second try (network, timeout, 5xx); never 4xx.
      retry: (count, error) => count < 2 && (!isApiError(error) || error.transient),
      retryDelay: (attempt) => Math.min(800 * 2 ** attempt, 4000),
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
})
