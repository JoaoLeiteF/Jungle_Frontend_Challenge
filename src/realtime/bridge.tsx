import { useEffect } from 'react'
import { toast } from 'sonner'
import { nftUpdatedSchema, orderUpdatedSchema, type CatalogPage, type Cart, type Nft, type NftUpdatedEvent, type Order, type OrderUpdatedEvent } from '@/api/contracts'
import { qk, queryClient } from '@/app/query'
import { scopeOf, session, useSession } from '@/app/session'
import { formatEth } from '@/lib/eth'
import { createEventGate } from './gate'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'wss://realtime.kurio.mock'

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting'
let status: RealtimeStatus = 'connecting'
const statusListeners = new Set<(s: RealtimeStatus) => void>()
const setStatus = (s: RealtimeStatus) => {
  status = s
  statusListeners.forEach((l) => l(s))
}
export const realtimeStatus = { get: () => status, subscribe: (l: (s: RealtimeStatus) => void) => (statusListeners.add(l), () => statusListeners.delete(l)) }

function applyNft(event: NftUpdatedEvent) {
  const patch = (nft: Nft): Nft => (nft.id === event.resource.id && nft.version < event.version ? { ...nft, ...event.data, version: event.version } : nft)
  queryClient.setQueryData<Nft>(qk.nft(event.resource.id), (old) => (old ? patch(old) : old))
  queryClient.setQueriesData<CatalogPage>({ queryKey: qk.catalogAll }, (old) => (old ? { ...old, items: old.items.map(patch) } : old))

  // Cart lines and the quote derive from the catalog: refresh them and tell the user if it matters to them.
  const scope = scopeOf(session.get())
  const cart = queryClient.getQueryData<Cart>(qk.cart(scope))
  const line = cart?.items.find((i) => i.nftId === event.resource.id)
  if (line) {
    queryClient.invalidateQueries({ queryKey: qk.cart(scope) })
    queryClient.invalidateQueries({ queryKey: qk.quote(scope) })
    const ed = event.data.editions.find((e) => e.edition === line.edition)
    if (ed && event.data.reason === 'price' && ed.priceEth !== line.unitPriceEth)
      toast.info(`Preço atualizado: ${line.nft.name} (${line.editionLabel}) agora custa ${formatEth(ed.priceEth)}.`, { id: `price-${line.id}` })
    if (ed && ed.available < line.quantity)
      toast.warning(ed.available === 0 ? `${line.nft.name} (${line.editionLabel}) esgotou.` : `${line.nft.name}: restam ${ed.available} unidade(s).`, { id: `stock-${line.id}` })
  }
}

function applyOrder(event: OrderUpdatedEvent) {
  const s = session.get()
  // An event addressed to another account (e.g. from a previous session) must never touch this cache.
  if (s.status !== 'authenticated' || s.user.id !== event.userId) return
  queryClient.setQueryData<Order>(qk.order(s.user.id, event.resource.id), (old) =>
    old && old.version < event.version ? { ...old, ...event.data, version: event.version, updatedAt: event.occurredAt } : old,
  )
  queryClient.invalidateQueries({ queryKey: qk.orders(s.user.id) })
  if (event.data.status === 'confirmed') queryClient.invalidateQueries({ queryKey: qk.cart(['u', s.user.id]) })
}

/** Owns the socket for the current session: one connection per token, torn down on logout/switch. */
export function RealtimeBridge() {
  const s = useSession()
  const token = s.status === 'authenticated' ? s.token : null
  const loading = s.status === 'loading'

  useEffect(() => {
    if (loading) return
    let disposed = false
    let cleanup = () => {}
    // Imported here, not at module top: engine.io-client captures globalThis.WebSocket when it is
    // evaluated, and this effect only runs after MSW has patched it (see main.tsx).
    import('socket.io-client').then(({ io }) => {
      if (disposed) return
      cleanup = connect(io, token)
    })
    return () => {
      disposed = true
      cleanup()
      setStatus('connecting')
    }
  }, [token, loading])

  return null
}

function connect(io: typeof import('socket.io-client').io, token: string | null) {
  const gate = createEventGate()
  const socket = io(SOCKET_URL, { transports: ['websocket'], auth: token ? { token } : {}, reconnectionDelay: 500, reconnectionDelayMax: 3000 })
  let connectedOnce = false

  socket.on('connect', () => {
    setStatus('connected')
    // After an outage, events may have been missed: reconcile everything on screen with REST.
    if (connectedOnce) queryClient.invalidateQueries({ type: 'active' })
    connectedOnce = true
  })
  socket.on('disconnect', () => setStatus('reconnecting'))
  socket.on('connect_error', () => setStatus('reconnecting'))
  socket.on('nft.updated', (raw: unknown) => {
    const parsed = nftUpdatedSchema.safeParse(raw)
    if (!parsed.success) return
    const known = queryClient.getQueryData<Nft>(qk.nft(parsed.data.resource.id))?.version ?? 0
    if (gate.accept(parsed.data, known)) applyNft(parsed.data)
  })
  socket.on('order.updated', (raw: unknown) => {
    const parsed = orderUpdatedSchema.safeParse(raw)
    if (!parsed.success) return
    const st = session.get()
    const known = st.status === 'authenticated' ? (queryClient.getQueryData<Order>(qk.order(st.user.id, parsed.data.resource.id))?.version ?? 0) : 0
    if (gate.accept(parsed.data, known)) applyOrder(parsed.data)
  })

  return () => {
    socket.removeAllListeners()
    socket.disconnect()
  }
}
