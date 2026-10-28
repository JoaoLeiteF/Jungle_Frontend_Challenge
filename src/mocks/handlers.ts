import { http, HttpResponse, delay } from 'msw'
import type { z } from 'zod'
import {
  addToCartInputSchema,
  catalogQuerySchema,
  createOrderInputSchema,
  loginInputSchema,
  passwordInputSchema,
  profileInputSchema,
  registerInputSchema,
  walletInputSchema,
  type ApiErrorBody,
  type Cart,
  type CatalogQuery,
  type ErrorCode,
  type Nft,
  type Quote,
  type QuoteIssue,
} from '@/api/contracts'
import { addEth, cmpEth, fromWei, mulEth, pctEth, subEth, toWei } from '@/lib/eth'
import { COUPONS, collectionLabel, db, hashPassword, networkLabel, nextId, persist, resetDb, reviewsFor, type DbCart, type DbOrder, type DbUser } from './db'
import { disconnectUser, emitNftUpdated, emitOrderUpdated } from './realtime'
import { failure, is, latency, scenario, sessionTtlMs, setScenario, SCENARIOS, type ScenarioName } from './scenarios'

const BASE = import.meta.env.VITE_API_URL ?? '/api'

// ---------- plumbing ----------
class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly fields?: Record<string, string>,
    readonly details?: unknown,
  ) {
    super(message)
  }
}
const fail = (status: number, code: ErrorCode, message: string, fields?: Record<string, string>, details?: unknown): never => {
  throw new HttpError(status, code, message, fields, details)
}

function parse<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const r = schema.safeParse(body)
  if (r.success) return r.data
  const fields: Record<string, string> = {}
  for (const issue of r.error.issues) fields[issue.path.join('.') || '_'] ??= issue.message
  return fail(400, 'VALIDATION', 'Verifique os campos destacados.', fields)
}

type Ctx = { request: Request; params: Record<string, string | readonly string[] | undefined>; url: URL }
type Handler = (ctx: Ctx) => unknown | Promise<unknown>

function route(method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string, fn: Handler) {
  return http[method](`${BASE}${path}`, async ({ request, params }) => {
    await latency()
    const url = new URL(request.url)
    const gate = failure(request.method, url.pathname.slice(BASE.length))
    if (gate) return gate
    try {
      const result = await fn({ request, params, url })
      persist()
      return result instanceof Response ? result : HttpResponse.json(result as object)
    } catch (e) {
      if (e instanceof HttpError) {
        persist()
        const body: ApiErrorBody = { error: { code: e.code, message: e.message, fields: e.fields, details: e.details } }
        return HttpResponse.json(body, { status: e.status })
      }
      console.error('[mock] handler crashed', e)
      return HttpResponse.json({ error: { code: 'INTERNAL', message: 'Erro interno.' } }, { status: 500 })
    }
  })
}

const param = (ctx: Ctx, k: string) => String(ctx.params[k] ?? '')
const json = async (ctx: Ctx) => {
  try {
    return await ctx.request.json()
  } catch {
    return {}
  }
}
/** Small stable hash (djb2) for idempotency bodies and quote fingerprints. */
function hash(value: unknown) {
  const s = JSON.stringify(value)
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// ---------- session ----------
function sessionOf(request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '')
  if (!token) return null
  const session = db.sessions.find((s) => s.token === token)
  if (!session) return { expired: true as const }
  if (session.expiresAt < Date.now()) {
    db.sessions = db.sessions.filter((s) => s !== session)
    disconnectUser(session.userId)
    return { expired: true as const }
  }
  session.expiresAt = Date.now() + sessionTtlMs() // sliding expiration
  return { session, user: db.users.find((u) => u.id === session.userId)! }
}
function requireUser(request: Request) {
  const s = sessionOf(request)
  if (!s) return fail(401, 'UNAUTHENTICATED', 'Faça login para continuar.')
  if ('expired' in s) return fail(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.')
  return s
}
const publicUser = ({ passwordHash: _h, salt: _s, ...u }: DbUser) => u

async function openSession(user: DbUser) {
  const token = `tok_${crypto.randomUUID()}`
  const expiresAt = Date.now() + sessionTtlMs()
  db.sessions.push({ token, userId: user.id, expiresAt })
  return { token, expiresAt: new Date(expiresAt).toISOString(), user: publicUser(user) }
}

// ---------- catalog ----------
const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const listItem = ({ reviews: _r, ...nft }: Nft) => nft

function parseCatalogQuery(url: URL): CatalogQuery {
  const p = url.searchParams
  const list = (k: string) => p.get(k)?.split(',').filter(Boolean)
  const num = (k: string) => (p.get(k) ? Number(p.get(k)) : undefined)
  return parse(catalogQuerySchema, {
    q: p.get('q') || undefined,
    collections: list('collections'),
    networks: list('networks'),
    min: p.get('min') || undefined,
    max: p.get('max') || undefined,
    tab: p.get('tab') || undefined,
    sort: p.get('sort') || undefined,
    page: num('page'),
    pageSize: num('pageSize'),
  })
}

function filterNfts(q: CatalogQuery, skip?: 'collections' | 'networks') {
  const needle = q.q ? norm(q.q.trim()) : ''
  const newest = [...db.nfts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 24).map((n) => n.id)
  return db.nfts.filter((n) => {
    if (needle && !norm(`${n.name} ${n.collectionName} ${n.creator}`).includes(needle)) return false
    if (skip !== 'collections' && q.collections?.length && !q.collections.includes(n.collection)) return false
    if (skip !== 'networks' && q.networks?.length && !q.networks.includes(n.network)) return false
    if (q.min && cmpEth(n.listPriceEth, q.min) < 0) return false
    if (q.max && cmpEth(n.listPriceEth, q.max) > 0) return false
    if (q.tab === 'new' && !newest.includes(n.id)) return false
    if (q.tab === 'trending' && n.trendingScore < 500) return false
    return true
  })
}

const SORTERS: Record<string, (a: Nft, b: Nft) => number> = {
  recent: (a, b) => b.createdAt.localeCompare(a.createdAt),
  'price-asc': (a, b) => cmpEth(a.listPriceEth, b.listPriceEth) || a.id.localeCompare(b.id),
  'price-desc': (a, b) => cmpEth(b.listPriceEth, a.listPriceEth) || a.id.localeCompare(b.id),
  'name-asc': (a, b) => a.name.localeCompare(b.name, 'pt-BR'),
  'rating-desc': (a, b) => b.rating - a.rating || a.id.localeCompare(b.id),
}

function facet<T extends string>(items: Nft[], key: 'collection' | 'network', label: (v: T) => string, values: readonly T[]) {
  return values.map((value) => ({ value, label: label(value), count: items.filter((n) => n[key] === value).length }))
}

function findNft(id: string) {
  return db.nfts.find((n) => n.id === id) ?? fail(404, 'NOT_FOUND', 'NFT não encontrado.')
}
function findEdition(nft: Nft, edition: number) {
  return nft.editions.find((e) => e.edition === edition) ?? fail(404, 'NOT_FOUND', 'Edição não encontrada.')
}

/** Every catalog mutation goes through here: bump version, persist, notify sockets. */
function touchNft(nft: Nft, reason: 'price' | 'availability') {
  nft.version += 1
  nft.listPriceEth = nft.editions[2]!.priceEth
  persist()
  emitNftUpdated(nft, reason)
}

// ---------- cart ----------
function cartKey(request: Request) {
  const s = sessionOf(request)
  if (s && 'expired' in s) return fail(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.')
  if (s) return `user:${s.user.id}`
  return request.headers.get('X-Cart-Id') || fail(400, 'VALIDATION', 'Carrinho não identificado.')
}
function getCart(key: string): DbCart {
  return (db.carts[key] ??= { id: key, items: [], couponCode: null, updatedAt: new Date().toISOString() })
}
function cartDto(cart: DbCart): Cart {
  return {
    id: cart.id,
    couponCode: cart.couponCode,
    updatedAt: cart.updatedAt,
    items: cart.items.flatMap((i) => {
      const nft = db.nfts.find((n) => n.id === i.nftId)
      const ed = nft?.editions.find((e) => e.edition === i.edition)
      if (!nft || !ed) return []
      return [
        {
          id: i.id,
          nftId: i.nftId,
          edition: i.edition,
          quantity: i.quantity,
          nft: { id: nft.id, name: nft.name, tokenId: nft.tokenId, image: nft.image, network: nft.network, collectionName: nft.collectionName },
          unitPriceEth: ed.priceEth,
          available: ed.available,
          maxPerOrder: ed.maxPerOrder,
          editionLabel: ed.label,
        },
      ]
    }),
  }
}
function assertQuantity(nft: Nft, edition: number, quantity: number) {
  const ed = findEdition(nft, edition)
  if (ed.available === 0) fail(409, 'EDITION_UNAVAILABLE', `A edição ${ed.label} está esgotada.`)
  const limit = Math.min(ed.available, ed.maxPerOrder)
  if (quantity > limit)
    fail(409, 'QUANTITY_LIMIT', `Máximo de ${limit} unidade(s) para a edição ${ed.label}.`, { quantity: `Máximo ${limit}` }, { limit })
  return ed
}
const touchCart = (cart: DbCart) => (cart.updatedAt = new Date().toISOString())

// ---------- quote ----------
const FEE_BASE = '0.004'
const FEE_PER_LINE = '0.004'
let scheduledFor: string | null = null

function computeQuote(cart: DbCart, userId: string): Quote & { cartId: string; userId: string } {
  const issues: QuoteIssue[] = []
  const items: Quote['items'] = []
  for (const i of cart.items) {
    const nft = db.nfts.find((n) => n.id === i.nftId)
    const ed = nft?.editions.find((e) => e.edition === i.edition)
    if (!nft || !ed) continue
    const qty = Math.min(i.quantity, ed.available, ed.maxPerOrder)
    if (qty === 0) {
      issues.push({ itemId: i.id, kind: 'sold-out', message: `${nft.name} (${ed.label}) esgotou.` })
      continue
    }
    if (qty < i.quantity)
      issues.push({ itemId: i.id, kind: 'quantity-reduced', message: `${nft.name}: só restam ${qty} unidade(s).`, previous: String(i.quantity), current: String(qty) })
    items.push({ itemId: i.id, nftId: nft.id, name: nft.name, image: nft.image, edition: ed.edition, editionLabel: ed.label, quantity: qty, unitPriceEth: ed.priceEth, lineTotalEth: mulEth(ed.priceEth, qty) })
  }
  const subtotal = items.length ? addEth(...items.map((i) => i.lineTotalEth)) : '0.00'
  const coupon = cart.couponCode && COUPONS[cart.couponCode] ? { code: cart.couponCode, percentOff: COUPONS[cart.couponCode]!.percentOff } : null
  const discount = coupon ? pctEth(subtotal, coupon.percentOff) : '0.00'
  const fee = items.length ? fromWei(toWei(FEE_BASE) + toWei(FEE_PER_LINE) * BigInt(items.length)) : '0.00'
  const total = addEth(subEth(subtotal, discount), fee)
  const body = { items, subtotal, discount, fee, total, coupon, issues }
  return {
    id: nextId('q'),
    version: hash(body),
    items,
    subtotalEth: subtotal,
    discountEth: discount,
    networkFeeEth: fee,
    totalEth: total,
    coupon,
    issues,
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    cartId: cart.id,
    userId,
  }
}

/** price-change / sold-out scenarios: mutate the first cart item a few seconds after a quote opens. */
function scheduleScenarioMutation(cart: DbCart) {
  const first = cart.items[0]
  if (!first || !is('price-change', 'sold-out') || scheduledFor === `${scenario()}:${cart.id}`) return
  scheduledFor = `${scenario()}:${cart.id}`
  const which = scenario()
  setTimeout(() => {
    const nft = db.nfts.find((n) => n.id === first.nftId)
    const ed = nft?.editions.find((e) => e.edition === first.edition)
    if (!nft || !ed) return
    if (which === 'price-change') ed.priceEth = addEth(ed.priceEth, '0.05')
    else ed.available = 0
    touchNft(nft, which === 'price-change' ? 'price' : 'availability')
  }, 4000)
}

// ---------- orders ----------
const SETTLE_MS = 2500
const timedOutOnce = new Set<string>()

function orderDto({ userId: _u, purchased: _p, settleAt: _s, outcome: _o, ...o }: DbOrder & { settleAt?: number; outcome?: string }) {
  return o
}
type PendingOrder = DbOrder & { settleAt: number; outcome: 'confirmed' | 'rejected' }

function settle(order: PendingOrder) {
  if (order.status !== 'pending') return
  if (order.outcome === 'confirmed') {
    // Availability may have changed while pending: confirm only what can still be fulfilled.
    const short = order.purchased.find((p) => {
      const ed = db.nfts.find((n) => n.id === p.nftId)?.editions.find((e) => e.edition === p.edition)
      return !ed || ed.available < p.quantity
    })
    if (short) {
      order.status = 'rejected'
      order.rejectionReason = 'Uma das edições esgotou antes da liquidação. Nenhum valor foi cobrado.'
    } else {
      order.status = 'confirmed'
      order.txHash = `0x${hash(order.id).padEnd(8, '0')}${hash(order.createdAt).padEnd(8, '0')}${'a'.repeat(48)}`.slice(0, 66)
      order.explorerUrl = `https://etherscan.io/tx/${order.txHash}`
      for (const p of order.purchased) {
        const nft = db.nfts.find((n) => n.id === p.nftId)!
        nft.editions.find((e) => e.edition === p.edition)!.available -= p.quantity
        touchNft(nft, 'availability')
      }
      // remove only what was bought from the buyer's cart
      const cart = db.carts[`user:${order.userId}`]
      if (cart) {
        for (const p of order.purchased) {
          const line = cart.items.find((i) => i.nftId === p.nftId && i.edition === p.edition)
          if (line) line.quantity -= p.quantity
        }
        cart.items = cart.items.filter((i) => i.quantity > 0)
        if (!cart.items.length) cart.couponCode = null
        touchCart(cart)
      }
    }
  } else {
    order.status = 'rejected'
    order.rejectionReason = 'Pagamento recusado pela carteira. Nenhum valor foi cobrado.'
  }
  order.version += 1
  order.updatedAt = new Date().toISOString()
  persist()
  emitOrderUpdated(order)
}

function scheduleSettle(order: PendingOrder) {
  setTimeout(() => settle(order), Math.max(0, order.settleAt - Date.now()))
}

/** After a reload the in-memory timers are gone: resume pending orders from persisted state. */
export function resumePendingOrders() {
  for (const o of db.orders as PendingOrder[]) if (o.status === 'pending') scheduleSettle(o)
}

// ---------- handlers ----------
export const handlers = [
  // auth
  route('post', '/auth/register', async (ctx) => {
    const input = parse(registerInputSchema, await json(ctx))
    const fields: Record<string, string> = {}
    if (db.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) fields.email = 'Este e-mail já está cadastrado.'
    if (db.users.some((u) => u.username.toLowerCase() === input.username.toLowerCase())) fields.username = 'Este nome de usuário já está em uso.'
    if (Object.keys(fields).length) fail(409, fields.email ? 'EMAIL_TAKEN' : 'USERNAME_TAKEN', 'Já existe uma conta com esses dados.', fields)
    const salt = crypto.randomUUID()
    const user: DbUser = {
      id: nextId('u'),
      email: input.email,
      username: input.username,
      displayName: input.username,
      avatarUrl: null,
      ensName: null,
      referralCode: null,
      salt,
      passwordHash: await hashPassword(input.password, salt),
    }
    db.users.push(user)
    return openSession(user)
  }),
  route('post', '/auth/login', async (ctx) => {
    const input = parse(loginInputSchema, await json(ctx))
    const user = db.users.find((u) => u.email.toLowerCase() === input.email.toLowerCase())
    if (!user || (await hashPassword(input.password, user.salt)) !== user.passwordHash)
      fail(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.', { password: 'E-mail ou senha incorretos.' })
    return openSession(user!)
  }),
  route('get', '/auth/session', ({ request }) => {
    const { session, user } = requireUser(request)
    return { token: session.token, expiresAt: new Date(session.expiresAt).toISOString(), user: publicUser(user) }
  }),
  route('post', '/auth/logout', ({ request }) => {
    const token = request.headers.get('Authorization')?.replace(/^Bearer /, '')
    const s = db.sessions.find((x) => x.token === token)
    db.sessions = db.sessions.filter((x) => x.token !== token)
    if (s && !db.sessions.some((x) => x.userId === s.userId)) disconnectUser(s.userId)
    return { ok: true }
  }),

  // catalog
  route('get', '/nfts', ({ url }) => {
    const q = parseCatalogQuery(url)
    const page = q.page ?? 1
    const pageSize = q.pageSize ?? 9
    const all = is('empty') ? [] : filterNfts(q).sort(SORTERS[q.sort ?? 'recent'])
    const prices = db.nfts.map((n) => n.listPriceEth).sort(cmpEth)
    return {
      items: all.slice((page - 1) * pageSize, page * pageSize).map(listItem),
      total: all.length,
      page,
      pageSize,
      pageCount: Math.max(1, Math.ceil(all.length / pageSize)),
      facets: {
        collections: facet(is('empty') ? [] : filterNfts(q, 'collections'), 'collection', collectionLabel, ['arte-digital', 'fotografia', 'musica', 'arte-3d', 'colecionaveis', 'generativa', 'jogos', 'assinaturas', 'utilidade'] as const),
        networks: facet(is('empty') ? [] : filterNfts(q, 'networks'), 'network', networkLabel, ['ethereum', 'polygon', 'solana'] as const),
        priceRange: { min: prices[0] ?? '0.00', max: prices.at(-1) ?? '0.00' },
      },
    }
  }),
  route('get', '/nfts/:id', (ctx) => {
    const nft = findNft(param(ctx, 'id'))
    return { ...nft, reviews: reviewsFor(nft) }
  }),

  // favorites
  route('get', '/favorites', ({ request }) => ({ nftIds: db.favorites[requireUser(request).user.id] ?? [] })),
  route('put', '/favorites/:id', (ctx) => {
    const { user } = requireUser(ctx.request)
    findNft(param(ctx, 'id'))
    const list = (db.favorites[user.id] ??= [])
    if (!list.includes(param(ctx, 'id'))) list.push(param(ctx, 'id'))
    return { ok: true }
  }),
  route('delete', '/favorites/:id', (ctx) => {
    const { user } = requireUser(ctx.request)
    db.favorites[user.id] = (db.favorites[user.id] ?? []).filter((id) => id !== param(ctx, 'id'))
    return { ok: true }
  }),

  // cart
  route('get', '/cart', ({ request }) => cartDto(getCart(cartKey(request)))),
  route('post', '/cart/items', async (ctx) => {
    const input = parse(addToCartInputSchema, await json(ctx))
    const cart = getCart(cartKey(ctx.request))
    const nft = findNft(input.nftId)
    const existing = cart.items.find((i) => i.nftId === input.nftId && i.edition === input.edition)
    assertQuantity(nft, input.edition, (existing?.quantity ?? 0) + input.quantity)
    if (existing) existing.quantity += input.quantity
    else cart.items.push({ id: nextId('ci'), nftId: input.nftId, edition: input.edition, quantity: input.quantity })
    touchCart(cart)
    return cartDto(cart)
  }),
  route('patch', '/cart/items/:itemId', async (ctx) => {
    const { quantity } = (await json(ctx)) as { quantity?: unknown }
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) fail(400, 'VALIDATION', 'Quantidade inválida.', { quantity: 'Use um número inteiro ≥ 1' })
    const cart = getCart(cartKey(ctx.request))
    const item = cart.items.find((i) => i.id === param(ctx, 'itemId')) ?? fail(404, 'NOT_FOUND', 'Item não está no carrinho.')
    assertQuantity(findNft(item.nftId), item.edition, quantity as number)
    item.quantity = quantity as number
    touchCart(cart)
    return cartDto(cart)
  }),
  route('delete', '/cart/items/:itemId', (ctx) => {
    const cart = getCart(cartKey(ctx.request))
    cart.items = cart.items.filter((i) => i.id !== param(ctx, 'itemId'))
    if (!cart.items.length) cart.couponCode = null
    touchCart(cart)
    return cartDto(cart)
  }),
  route('put', '/cart/coupon', async (ctx) => {
    const { code } = (await json(ctx)) as { code?: string | null }
    const cart = getCart(cartKey(ctx.request))
    if (!code) cart.couponCode = null
    else {
      const normalized = code.trim().toUpperCase()
      const coupon = COUPONS[normalized]
      if (!coupon) fail(422, 'COUPON_INVALID', 'Cupom inválido.', { code: 'Cupom inválido.' })
      if (new Date(coupon!.expiresAt).getTime() < Date.now()) fail(422, 'COUPON_EXPIRED', 'Este cupom expirou.', { code: 'Este cupom expirou.' })
      cart.couponCode = normalized
    }
    touchCart(cart)
    return cartDto(cart)
  }),
  route('post', '/cart/merge', async (ctx) => {
    const { user } = requireUser(ctx.request)
    const { guestCartId } = (await json(ctx)) as { guestCartId?: string }
    const cart = getCart(`user:${user.id}`)
    const guest = guestCartId ? db.carts[guestCartId] : undefined
    if (guest && guest.id !== cart.id) {
      for (const g of guest.items) {
        const nft = db.nfts.find((n) => n.id === g.nftId)
        const ed = nft?.editions.find((e) => e.edition === g.edition)
        if (!ed) continue
        const line = cart.items.find((i) => i.nftId === g.nftId && i.edition === g.edition)
        const limit = Math.min(ed.available, ed.maxPerOrder)
        if (line) line.quantity = Math.min(limit, line.quantity + g.quantity)
        else if (limit > 0) cart.items.push({ ...g, id: nextId('ci'), quantity: Math.min(limit, g.quantity) })
      }
      cart.couponCode ??= guest.couponCode
      delete db.carts[guest.id]
      touchCart(cart)
    }
    return cartDto(cart)
  }),

  // quote
  route('post', '/quote', ({ request }) => {
    const key = cartKey(request)
    const cart = getCart(key)
    const s = sessionOf(request)
    const quote = computeQuote(cart, s && !('expired' in s) ? s.user.id : 'guest')
    db.quotes = Object.fromEntries(Object.entries(db.quotes).filter(([, q]) => q.cartId !== cart.id)) // keep only the latest per cart
    db.quotes[quote.id] = quote
    scheduleScenarioMutation(cart)
    const { cartId: _c, userId: _u, ...dto } = quote
    return dto
  }),

  // orders
  route('post', '/orders', async (ctx) => {
    const { user, session } = requireUser(ctx.request)
    const key = ctx.request.headers.get('Idempotency-Key') ?? fail(400, 'VALIDATION', 'Header Idempotency-Key é obrigatório.')
    const raw = await json(ctx)
    const bodyHash = hash(raw)
    const prior = db.idempotency.find((r) => r.key === key)
    if (prior) {
      if (prior.userId !== user.id || prior.bodyHash !== bodyHash)
        fail(409, 'IDEMPOTENCY_MISMATCH', 'Esta tentativa de compra já foi usada com outro conteúdo.')
      return orderDto(db.orders.find((o) => o.id === prior.orderId)!)
    }
    const input = parse(createOrderInputSchema, raw)
    const wallet = db.wallets.find((w) => w.id === input.walletId && w.userId === user.id) ?? fail(404, 'NOT_FOUND', 'Carteira não encontrada.', { walletId: 'Selecione uma carteira cadastrada.' })
    if (session.connectedWalletId !== wallet.id) fail(409, 'WALLET_REJECTED', 'Conecte a carteira antes de confirmar.', { walletId: 'Carteira desconectada.' })
    if (wallet.network !== input.network) fail(400, 'VALIDATION', 'Rede incompatível com a carteira.', { network: `${wallet.label} opera na rede ${networkLabel(wallet.network)}.` })

    const cart = getCart(`user:${user.id}`)
    const fresh = computeQuote(cart, user.id)
    if (!fresh.items.length) fail(409, 'OUT_OF_STOCK', 'Nenhum item disponível para compra.')
    if (fresh.version !== input.quoteVersion || fresh.issues.length) {
      db.quotes[fresh.id] = fresh
      const { cartId: _c, userId: _u, ...dto } = fresh
      fail(409, 'QUOTE_STALE', 'Preço, disponibilidade ou taxas mudaram. Revise e confirme novamente.', undefined, { quote: dto })
    }

    const now = new Date().toISOString()
    const order: PendingOrder = {
      id: nextId('ord'),
      userId: user.id,
      status: 'pending',
      version: 1,
      createdAt: now,
      updatedAt: now,
      txHash: null,
      explorerUrl: null,
      rejectionReason: null,
      network: input.network,
      wallet: { id: wallet.id, label: wallet.label, provider: wallet.provider, address: wallet.address },
      buyer: input.buyer,
      items: fresh.items,
      subtotalEth: fresh.subtotalEth,
      discountEth: fresh.discountEth,
      networkFeeEth: fresh.networkFeeEth,
      totalEth: fresh.totalEth,
      couponCode: fresh.coupon?.code ?? null,
      purchased: fresh.items.map((i) => ({ nftId: i.nftId, edition: i.edition, quantity: i.quantity })),
      settleAt: Date.now() + SETTLE_MS,
      outcome: is('payment-declined') ? 'rejected' : 'confirmed',
    }
    db.orders.push(order)
    db.idempotency.push({ key, userId: user.id, bodyHash, orderId: order.id })
    persist()
    scheduleSettle(order)
    if (is('order-timeout') && !timedOutOnce.has(key)) {
      timedOutOnce.add(key)
      await delay(12_000) // longer than the client timeout: the order exists, the response never arrives in time
    }
    return HttpResponse.json(orderDto(order), { status: 201 })
  }),
  route('get', '/orders', ({ request }) => {
    const { user } = requireUser(request)
    return { items: db.orders.filter((o) => o.userId === user.id).map(orderDto).reverse() }
  }),
  route('get', '/orders/:id', (ctx) => {
    const { user } = requireUser(ctx.request)
    const order = (db.orders.find((o) => o.id === param(ctx, 'id')) as PendingOrder | undefined) ?? fail(404, 'NOT_FOUND', 'Pedido não encontrado.')
    if (order.userId !== user.id) fail(403, 'FORBIDDEN', 'Este pedido pertence a outra conta.')
    if (order.status === 'pending' && order.settleAt <= Date.now()) settle(order)
    return orderDto(order)
  }),

  // profile
  route('get', '/me', ({ request }) => publicUser(requireUser(request).user)),
  route('patch', '/me', async (ctx) => {
    const { user } = requireUser(ctx.request)
    const input = parse(profileInputSchema, await json(ctx))
    const fields: Record<string, string> = {}
    if (db.users.some((u) => u.id !== user.id && u.email.toLowerCase() === input.email.toLowerCase())) fields.email = 'Este e-mail já está cadastrado.'
    if (db.users.some((u) => u.id !== user.id && u.username.toLowerCase() === input.username.toLowerCase())) fields.username = 'Este nome de usuário já está em uso.'
    if (Object.keys(fields).length) fail(409, fields.email ? 'EMAIL_TAKEN' : 'USERNAME_TAKEN', 'Já existe uma conta com esses dados.', fields)
    Object.assign(user, {
      displayName: input.displayName,
      username: input.username,
      email: input.email,
      ensName: input.ensName || null,
      referralCode: input.referralCode || null,
      ...(input.avatarDataUrl !== undefined ? { avatarUrl: input.avatarDataUrl } : {}),
    })
    return publicUser(user)
  }),
  route('post', '/me/password', async (ctx) => {
    const { user } = requireUser(ctx.request)
    const input = parse(passwordInputSchema, await json(ctx))
    if ((await hashPassword(input.currentPassword, user.salt)) !== user.passwordHash)
      fail(400, 'VALIDATION', 'Senha atual incorreta.', { currentPassword: 'Senha atual incorreta.' })
    user.salt = crypto.randomUUID()
    user.passwordHash = await hashPassword(input.newPassword, user.salt)
    return { ok: true }
  }),

  // wallets
  route('get', '/wallets', ({ request }) => {
    const { user } = requireUser(request)
    return { items: db.wallets.filter((w) => w.userId === user.id).map(({ userId: _u, ...w }) => w) }
  }),
  route('post', '/wallets', async (ctx) => {
    const { user } = requireUser(ctx.request)
    const input = parse(walletInputSchema, await json(ctx))
    if (db.wallets.some((w) => w.userId === user.id && w.role === input.role))
      fail(409, 'VALIDATION', 'Você já tem uma carteira com esse papel.', { role: input.role === 'primary' ? 'Já existe uma carteira principal.' : 'Já existe uma carteira secundária.' })
    if (db.wallets.some((w) => w.userId === user.id && w.address.toLowerCase() === input.address.toLowerCase()))
      fail(409, 'VALIDATION', 'Endereço já cadastrado.', { address: 'Este endereço já está cadastrado.' })
    const wallet = { ...input, id: nextId('w'), userId: user.id, ensName: input.ensName || null, referralCode: input.referralCode || null, updatedAt: new Date().toISOString() }
    db.wallets.push(wallet)
    const { userId: _u, ...dto } = wallet
    return HttpResponse.json(dto, { status: 201 })
  }),
  route('patch', '/wallets/:id', async (ctx) => {
    const { user } = requireUser(ctx.request)
    const wallet = db.wallets.find((w) => w.id === param(ctx, 'id') && w.userId === user.id) ?? fail(404, 'NOT_FOUND', 'Carteira não encontrada.')
    const input = parse(walletInputSchema, await json(ctx))
    if (db.wallets.some((w) => w.userId === user.id && w.id !== wallet.id && w.role === input.role))
      fail(409, 'VALIDATION', 'Você já tem uma carteira com esse papel.', { role: 'Papel já ocupado por outra carteira.' })
    Object.assign(wallet, { ...input, ensName: input.ensName || null, referralCode: input.referralCode || null, updatedAt: new Date().toISOString() })
    const { userId: _u, ...dto } = wallet
    return dto
  }),
  // wallet connection simulation (no real extension): connect may be refused, disconnect always works
  route('post', '/wallets/:id/connect', (ctx) => {
    const { user, session } = requireUser(ctx.request)
    const wallet = db.wallets.find((w) => w.id === param(ctx, 'id') && w.userId === user.id) ?? fail(404, 'NOT_FOUND', 'Carteira não encontrada.')
    if (is('wallet-rejected')) fail(403, 'WALLET_REJECTED', 'A conexão foi recusada na carteira.')
    session.connectedWalletId = wallet.id
    return { ok: true, walletId: wallet.id, address: wallet.address }
  }),
  route('post', '/wallets/:id/disconnect', ({ request }) => {
    const { session } = requireUser(request)
    session.connectedWalletId = null
    return { ok: true }
  }),

  // mock controls (only exist while MSW is on)
  route('post', '/__mock/reset', async () => {
    await resetDb()
    setScenario('default')
    scheduledFor = null
    return { ok: true }
  }),
  route('get', '/__mock/scenario', () => ({ scenario: scenario(), available: SCENARIOS })),
  route('put', '/__mock/scenario', async (ctx) => {
    const { scenario: name } = (await json(ctx)) as { scenario?: ScenarioName }
    setScenario(name ?? 'default')
    scheduledFor = null
    return { scenario: scenario() }
  }),
]

export { touchNft, findNft }
