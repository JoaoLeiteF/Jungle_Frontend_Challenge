// Simulated Socket.IO server. MSW intercepts the WebSocket opened by the real `socket.io-client`
// and @mswjs/socket.io-binding encodes/decodes the Socket.IO protocol on top of it.
//
// Binding limitations (documented in ARCHITECTURE.md): no rooms/namespaces/broadcast, handshake is
// synthesized, websocket transport only. So this module tracks connections itself, reads the auth
// token from the raw CONNECT packet ("40{...}"), filters order events per user and sends the
// engine.io heartbeat ("2") the client expects.
import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { Nft, NftUpdatedEvent, OrderUpdatedEvent, RealtimeEvent } from '@/api/contracts'
import { db, nextEventId, type DbOrder } from './db'

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? 'wss://realtime.kurio.mock'
const link = ws.link(`${SOCKET_URL}/*`)

type Connection = Parameters<Parameters<typeof link.addEventListener>[1]>[0]
interface Peer {
  conn: Connection
  io: ReturnType<typeof toSocketIo>
  userId: string | null
  heartbeat: ReturnType<typeof setInterval>
}

const peers = new Set<Peer>()
let down = false
const history: { event: RealtimeEvent; userId: string | null }[] = []

function userFromToken(token: unknown) {
  if (typeof token !== 'string') return null
  const s = db.sessions.find((x) => x.token === token && x.expiresAt > Date.now())
  return s?.userId ?? null
}

export const realtimeHandler = link.addEventListener('connection', (conn) => {
  if (down) {
    conn.client.close(1011, 'unavailable')
    return
  }
  const io = toSocketIo(conn)
  const peer: Peer = { conn, io, userId: null, heartbeat: setInterval(() => conn.client.send('2'), 20_000) }
  peers.add(peer)

  conn.client.addEventListener('message', (e) => {
    // Socket.IO CONNECT packet carries `auth` — e.g. 40{"token":"..."}
    if (typeof e.data === 'string' && e.data.startsWith('40')) {
      try {
        peer.userId = userFromToken(JSON.parse(e.data.slice(2) || '{}').token)
      } catch {
        peer.userId = null
      }
    }
  })
  conn.client.addEventListener('close', () => {
    clearInterval(peer.heartbeat)
    peers.delete(peer)
  })
})

/** A socket closed while still CONNECTING never fires 'close' on the interceptor — prune by readyState. */
function prune() {
  for (const p of peers)
    if ((p.conn.client as unknown as { socket: WebSocket }).socket.readyState === WebSocket.CLOSED) {
      clearInterval(p.heartbeat)
      peers.delete(p)
    }
}

function send(event: RealtimeEvent, userId: string | null) {
  prune()
  history.push({ event, userId })
  for (const p of peers) if (userId === null || p.userId === userId) p.io.client.emit(event.type, event)
}

export function emitNftUpdated(nft: Nft, reason: 'price' | 'availability') {
  const event: NftUpdatedEvent = {
    eventId: nextEventId(),
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: new Date().toISOString(),
    data: { listPriceEth: nft.listPriceEth, editions: nft.editions, reason },
  }
  send(event, null)
}

export function emitOrderUpdated(order: DbOrder) {
  const event: OrderUpdatedEvent = {
    eventId: nextEventId(),
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: new Date().toISOString(),
    userId: order.userId,
    data: { status: order.status, txHash: order.txHash, explorerUrl: order.explorerUrl, rejectionReason: order.rejectionReason },
  }
  send(event, order.userId)
}

// ---------- controls for scenarios and tests ----------
/** Re-delivers the last event verbatim (duplicate). */
export function replayLast() {
  const last = history.at(-1)
  if (last) for (const p of peers) if (last.userId === null || p.userId === last.userId) p.io.client.emit(last.event.type, last.event)
}
/** Delivers an older version of the last event for the given resource (stale/out of order). */
export function replayStale(resourceId: string) {
  const prev = [...history].reverse().filter((h) => h.event.resource.id === resourceId)[1]
  if (prev) for (const p of peers) if (prev.userId === null || p.userId === prev.userId) p.io.client.emit(prev.event.type, prev.event)
}
/** Drops every socket and refuses reconnection for `ms` (simulated outage). */
export function outage(ms: number) {
  down = true
  for (const p of peers) p.conn.client.close(1012, 'outage')
  setTimeout(() => (down = false), ms)
}
export const isDown = () => down
/** Session ended server-side: drop that user's sockets so no event reaches a stale session. */
export function disconnectUser(userId: string) {
  for (const p of peers) if (p.userId === userId) p.conn.client.close(1000, 'logout')
}
export const peerCount = () => (prune(), peers.size)
