import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isApiError } from '@/api/client'
import { quoteSchema, type CreateOrderInput, type Quote, type WalletProvider } from '@/api/contracts'
import { api } from '@/api/endpoints'
import { qk } from '@/app/query'
import { useScope, useSession } from '@/app/session'
import { attempts } from './attempt'

export function useConnectWallet() {
  return useMutation({ mutationFn: ({ walletId, provider }: { walletId: string; provider: WalletProvider }) => api.wallets.connect(walletId, provider) })
}
export function useDisconnectWallet() {
  return useMutation({ mutationFn: (walletId: string) => api.wallets.disconnect(walletId) })
}

const MAX_TIMEOUT_RETRIES = 3

/**
 * Creates the order idempotently. A timeout or dropped connection is retried with the same key and body,
 * so the server hands back the order it already created instead of charging twice.
 */
export function useCreateOrder() {
  const s = useSession()
  const scope = useScope()
  const qc = useQueryClient()
  const userId = s.status === 'authenticated' ? s.user.id : ''
  return useMutation({
    scope: { id: 'checkout' }, // a second click queues behind the first and replays the same key
    mutationFn: async (body: CreateOrderInput) => {
      const attempt = attempts.forBody(userId, body)
      for (let i = 0; ; i++) {
        try {
          const order = await api.orders.create(attempt.body, attempt.key)
          attempts.setOrder(attempt, order.id)
          return order
        } catch (e) {
          const recoverable = isApiError(e) && (e.code === 'TIMEOUT' || e.code === 'NETWORK')
          if (!recoverable || i >= MAX_TIMEOUT_RETRIES) throw e
          await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
        }
      }
    },
    onSuccess: (order) => qc.setQueryData(qk.order(userId, order.id), order),
    onError: (e) => {
      // A stale quote comes back with the fresh one: show it immediately.
      if (isApiError(e) && e.code === 'QUOTE_STALE') {
        const fresh = quoteSchema.safeParse((e.details as { quote?: unknown } | undefined)?.quote)
        if (fresh.success) qc.setQueriesData<Quote>({ queryKey: qk.quote(scope) }, () => fresh.data)
        qc.invalidateQueries({ queryKey: qk.cart(scope) })
      }
      // Only an attempt that may exist on the server (timeout, lost connection) is worth replaying later.
      if (!isApiError(e) || !e.transient) attempts.clear()
    },
  })
}

export function useOrder(orderId: string) {
  const s = useSession()
  const userId = s.status === 'authenticated' ? s.user.id : '-'
  return useQuery({
    queryKey: qk.order(userId, orderId),
    queryFn: ({ signal }) => api.orders.get(orderId, { signal }),
    enabled: s.status === 'authenticated',
    // Socket is the fast path; polling while pending covers an outage or missed event.
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 5000 : false),
  })
}
