import { z } from 'zod'
import { request } from './client'
import {
  cartSchema,
  catalogPageSchema,
  nftSchema,
  orderSchema,
  quoteSchema,
  sessionSchema,
  userSchema,
  walletSchema,
  type AddToCartInput,
  type CatalogQuery,
  type CreateOrderInput,
  type LoginInput,
  type PasswordInput,
  type ProfileInput,
  type RegisterInput,
  type WalletInput,
  type WalletProvider,
} from './contracts'

type Opts = { signal?: AbortSignal }
const ok = z.object({ ok: z.literal(true) })

/** Arrays go out as comma lists so the API sees exactly what the URL holds. */
function catalogParams(q: CatalogQuery) {
  return {
    ...q,
    collections: q.collections?.length ? q.collections.join(',') : undefined,
    networks: q.networks?.length ? q.networks.join(',') : undefined,
  }
}

export const api = {
  auth: {
    register: (body: RegisterInput) => request(sessionSchema, { method: 'POST', url: '/auth/register', data: body }),
    login: (body: LoginInput) => request(sessionSchema, { method: 'POST', url: '/auth/login', data: body }),
    session: ({ signal }: Opts = {}) => request(sessionSchema, { url: '/auth/session', signal }),
    logout: () => request(ok, { method: 'POST', url: '/auth/logout' }),
  },
  nfts: {
    list: (query: CatalogQuery, { signal }: Opts = {}) => request(catalogPageSchema, { url: '/nfts', params: catalogParams(query), signal }),
    get: (id: string, { signal }: Opts = {}) => request(nftSchema, { url: `/nfts/${encodeURIComponent(id)}`, signal }),
  },
  favorites: {
    list: ({ signal }: Opts = {}) => request(z.object({ nftIds: z.array(z.string()) }), { url: '/favorites', signal }),
    add: (nftId: string) => request(ok, { method: 'PUT', url: `/favorites/${encodeURIComponent(nftId)}` }),
    remove: (nftId: string) => request(ok, { method: 'DELETE', url: `/favorites/${encodeURIComponent(nftId)}` }),
  },
  cart: {
    get: ({ signal }: Opts = {}) => request(cartSchema, { url: '/cart', signal }),
    add: (body: AddToCartInput) => request(cartSchema, { method: 'POST', url: '/cart/items', data: body }),
    update: (itemId: string, quantity: number) => request(cartSchema, { method: 'PATCH', url: `/cart/items/${itemId}`, data: { quantity } }),
    remove: (itemId: string) => request(cartSchema, { method: 'DELETE', url: `/cart/items/${itemId}` }),
    merge: (guestCartId: string) => request(cartSchema, { method: 'POST', url: '/cart/merge', data: { guestCartId } }),
    setCoupon: (code: string | null) => request(cartSchema, { method: 'PUT', url: '/cart/coupon', data: { code } }),
  },
  quote: {
    create: ({ signal }: Opts = {}) => request(quoteSchema, { method: 'POST', url: '/quote', signal }),
  },
  orders: {
    create: (body: CreateOrderInput, idempotencyKey: string) =>
      request(orderSchema, { method: 'POST', url: '/orders', data: body, headers: { 'Idempotency-Key': idempotencyKey } }),
    get: (id: string, { signal }: Opts = {}) => request(orderSchema, { url: `/orders/${encodeURIComponent(id)}`, signal }),
  },
  me: {
    get: ({ signal }: Opts = {}) => request(userSchema, { url: '/me', signal }),
    update: (body: ProfileInput) => request(userSchema, { method: 'PATCH', url: '/me', data: body }),
    changePassword: (body: PasswordInput) => request(ok, { method: 'POST', url: '/me/password', data: body }),
  },
  wallets: {
    list: ({ signal }: Opts = {}) => request(z.object({ items: z.array(walletSchema) }), { url: '/wallets', signal }),
    create: (body: WalletInput) => request(walletSchema, { method: 'POST', url: '/wallets', data: body }),
    update: (id: string, body: WalletInput) => request(walletSchema, { method: 'PATCH', url: `/wallets/${id}`, data: body }),
    connect: (id: string, provider: WalletProvider) =>
      request(z.object({ ok: z.literal(true), walletId: z.string(), address: z.string() }), { method: 'POST', url: `/wallets/${id}/connect`, data: { provider } }),
    disconnect: (id: string) => request(ok, { method: 'POST', url: `/wallets/${id}/disconnect` }),
  },
}
