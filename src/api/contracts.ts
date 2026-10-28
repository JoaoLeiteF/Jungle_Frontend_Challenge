// REST + realtime contracts. The same zod schemas validate responses in the Axios layer,
// request bodies in the MSW handlers and form input in the UI, so the three never drift.
import { z } from 'zod'
import { isEth } from '@/lib/eth'

export const ethString = z.string().refine(isEth, 'Valor ETH inválido')

export const NETWORKS = ['ethereum', 'polygon', 'solana'] as const
export const networkSchema = z.enum(NETWORKS)
export type Network = z.infer<typeof networkSchema>

export const COLLECTIONS = [
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
] as const
export const collectionSchema = z.enum(COLLECTIONS)
export type Collection = z.infer<typeof collectionSchema>

export const SORTS = ['recent', 'price-asc', 'price-desc', 'name-asc', 'rating-desc'] as const
export const sortSchema = z.enum(SORTS)
export type Sort = z.infer<typeof sortSchema>

export const TABS = ['all', 'new', 'trending'] as const
export const tabSchema = z.enum(TABS)
export type Tab = z.infer<typeof tabSchema>

// ---------- errors ----------
export const ERROR_CODES = [
  'VALIDATION',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'INVALID_CREDENTIALS',
  'OUT_OF_STOCK',
  'QUANTITY_LIMIT',
  'EDITION_UNAVAILABLE',
  'QUOTE_STALE',
  'IDEMPOTENCY_MISMATCH',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'WALLET_REJECTED',
  'UNAVAILABLE',
  'INTERNAL',
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]
export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; fields?: Record<string, string>; details?: unknown }
}

// ---------- catalog ----------
export const editionSchema = z.object({
  edition: z.number().int().positive(),
  label: z.string(),
  priceEth: ethString,
  available: z.number().int().nonnegative(),
  maxPerOrder: z.number().int().positive(),
})
export type Edition = z.infer<typeof editionSchema>

export const nftSchema = z.object({
  id: z.string(),
  name: z.string(),
  tokenId: z.string(),
  collection: collectionSchema,
  collectionName: z.string(),
  network: networkSchema,
  image: z.string(),
  description: z.string(),
  creator: z.string(),
  attributes: z.array(z.string()),
  rating: z.number(),
  reviewCount: z.number().int(),
  listPriceEth: ethString, // lowest edition price, used for sort/filter
  compareAtEth: ethString.nullable(), // struck-through previous price ("1.99 ETH 2.29 ETH")
  editions: z.array(editionSchema),
  contractAddress: z.string(),
  royaltyPercent: z.number(),
  createdAt: z.string(),
  trendingScore: z.number(),
  version: z.number().int(),
  // detail-only payload (omitted from listings)
  reviews: z.array(z.object({ id: z.string(), author: z.string(), rating: z.number().int(), text: z.string(), createdAt: z.string() })).optional(),
})
export type Nft = z.infer<typeof nftSchema>

export const catalogQuerySchema = z.object({
  q: z.string().optional(),
  collections: z.array(collectionSchema).optional(),
  networks: z.array(networkSchema).optional(),
  min: ethString.optional(),
  max: ethString.optional(),
  tab: tabSchema.optional(),
  sort: sortSchema.optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(48).optional(),
})
export type CatalogQuery = z.infer<typeof catalogQuerySchema>

export const facetSchema = z.object({ value: z.string(), label: z.string(), count: z.number().int() })
export const catalogPageSchema = z.object({
  items: z.array(nftSchema),
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
  pageCount: z.number().int(),
  facets: z.object({
    collections: z.array(facetSchema),
    networks: z.array(facetSchema),
    priceRange: z.object({ min: ethString, max: ethString }),
  }),
})
export type CatalogPage = z.infer<typeof catalogPageSchema>

// ---------- auth / account ----------
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  ensName: z.string().nullable(),
  referralCode: z.string().nullable(),
})
export type User = z.infer<typeof userSchema>

export const sessionSchema = z.object({ token: z.string(), expiresAt: z.string(), user: userSchema })
export type Session = z.infer<typeof sessionSchema>

const password = z
  .string()
  .min(8, 'Mínimo de 8 caracteres')
  .regex(/[A-Za-z]/, 'Inclua ao menos uma letra')
  .regex(/\d/, 'Inclua ao menos um número')

export const loginInputSchema = z.object({
  email: z.string().trim().email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe a senha'),
})
export type LoginInput = z.infer<typeof loginInputSchema>

const username = z
  .string()
  .trim()
  .min(3, 'Mínimo de 3 caracteres')
  .max(24, 'Máximo de 24 caracteres')
  .regex(/^[a-z0-9_.]+$/i, 'Use letras, números, ponto ou _')

export const registerInputSchema = z
  .object({
    username,
    email: z.string().trim().email('Informe um e-mail válido'),
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem' })
export type RegisterInput = z.infer<typeof registerInputSchema>

export const profileInputSchema = z.object({
  displayName: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(40, 'Máximo de 40 caracteres'),
  username,
  email: z.string().trim().email('Informe um e-mail válido'),
  ensName: z
    .string()
    .trim()
    .regex(/^$|^[a-z0-9-]+$/i, 'Use letras, números ou hífen')
    .optional(),
  referralCode: z.string().trim().max(16, 'Máximo de 16 caracteres').optional(),
  avatarDataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/, 'Formato de imagem inválido')
    .max(700_000, 'Imagem acima de 500 KB')
    .nullable()
    .optional(),
})
export type ProfileInput = z.infer<typeof profileInputSchema>

export const passwordInputSchema = z
  .object({ currentPassword: z.string().min(1, 'Informe a senha atual'), newPassword: password, confirmPassword: z.string() })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não conferem' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'A nova senha deve ser diferente da atual' })
export type PasswordInput = z.infer<typeof passwordInputSchema>

// ---------- wallets ----------
export const WALLET_PROVIDERS = ['metamask', 'walletconnect', 'coinbase'] as const
export const walletProviderSchema = z.enum(WALLET_PROVIDERS)
export type WalletProvider = z.infer<typeof walletProviderSchema>

export const walletSchema = z.object({
  id: z.string(),
  role: z.enum(['primary', 'secondary']),
  label: z.string(),
  provider: walletProviderSchema,
  network: networkSchema,
  address: z.string(),
  ensName: z.string().nullable(),
  ownerName: z.string(),
  email: z.string(),
  referralCode: z.string().nullable(),
  updatedAt: z.string(),
})
export type Wallet = z.infer<typeof walletSchema>

export const walletInputSchema = z
  .object({
    role: z.enum(['primary', 'secondary']),
    label: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(32, 'Máximo de 32 caracteres'),
    provider: walletProviderSchema,
    network: networkSchema,
    address: z.string().trim().min(1, 'Informe o endereço'),
    ensName: z.string().trim().optional(),
    ownerName: z.string().trim().min(2, 'Informe o nome do perfil'),
    email: z.string().trim().email('Informe um e-mail válido'),
    referralCode: z.string().trim().max(16, 'Máximo de 16 caracteres').optional(),
  })
  .superRefine((v, ctx) => {
    const ok = v.network === 'solana' ? /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(v.address) : /^0x[a-fA-F0-9]{40}$/.test(v.address)
    if (!ok)
      ctx.addIssue({
        code: 'custom',
        path: ['address'],
        message: v.network === 'solana' ? 'Endereço Solana inválido (base58, 32–44 caracteres)' : 'Endereço inválido (0x + 40 hex)',
      })
    if (v.ensName && v.network !== 'ethereum') ctx.addIssue({ code: 'custom', path: ['ensName'], message: 'ENS só existe na rede Ethereum' })
    if (v.ensName && !/^[a-z0-9-]+\.eth$/i.test(v.ensName)) ctx.addIssue({ code: 'custom', path: ['ensName'], message: 'Use o formato nome.eth' })
  })
export type WalletInput = z.infer<typeof walletInputSchema>

// ---------- cart / quote ----------
export const cartItemSchema = z.object({
  id: z.string(),
  nftId: z.string(),
  edition: z.number().int(),
  quantity: z.number().int().positive(),
  nft: nftSchema.pick({ id: true, name: true, tokenId: true, image: true, network: true, collectionName: true }),
  unitPriceEth: ethString,
  available: z.number().int().nonnegative(),
  maxPerOrder: z.number().int().positive(),
  editionLabel: z.string(),
})
export type CartItem = z.infer<typeof cartItemSchema>

export const cartSchema = z.object({ id: z.string(), items: z.array(cartItemSchema), couponCode: z.string().nullable(), updatedAt: z.string() })
export type Cart = z.infer<typeof cartSchema>

export const addToCartInputSchema = z.object({ nftId: z.string(), edition: z.number().int().positive(), quantity: z.number().int().positive() })
export type AddToCartInput = z.infer<typeof addToCartInputSchema>

export const quoteIssueSchema = z.object({
  itemId: z.string(),
  kind: z.enum(['price-changed', 'quantity-reduced', 'sold-out']),
  message: z.string(),
  previous: z.string().optional(),
  current: z.string().optional(),
})
export type QuoteIssue = z.infer<typeof quoteIssueSchema>

export const quoteSchema = z.object({
  id: z.string(),
  version: z.string(), // fingerprint of prices + availability + coupon + fee
  items: z.array(
    z.object({ itemId: z.string(), nftId: z.string(), name: z.string(), image: z.string(), edition: z.number().int(), editionLabel: z.string(), quantity: z.number().int(), unitPriceEth: ethString, lineTotalEth: ethString }),
  ),
  subtotalEth: ethString,
  discountEth: ethString,
  networkFeeEth: ethString,
  totalEth: ethString,
  coupon: z.object({ code: z.string(), percentOff: z.number() }).nullable(),
  issues: z.array(quoteIssueSchema),
  expiresAt: z.string(),
})
export type Quote = z.infer<typeof quoteSchema>

// ---------- orders ----------
const ORDER_STATUSES = ['pending', 'confirmed', 'rejected'] as const
export const orderStatusSchema = z.enum(ORDER_STATUSES)

export const buyerSchema = z.object({
  displayName: z.string().trim().min(2, 'Informe o nome de exibição'),
  username: z.string().trim().min(3, 'Informe o nome de usuário'),
  email: z.string().trim().email('Informe um e-mail válido'),
  note: z.string().trim().max(280, 'Máximo de 280 caracteres').optional(),
})
export type Buyer = z.infer<typeof buyerSchema>

export const createOrderInputSchema = z.object({
  quoteId: z.string(),
  quoteVersion: z.string(),
  walletId: z.string(),
  network: networkSchema,
  buyer: buyerSchema,
})
export type CreateOrderInput = z.infer<typeof createOrderInputSchema>

export const orderSchema = z.object({
  id: z.string(),
  status: orderStatusSchema,
  version: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
  txHash: z.string().nullable(),
  explorerUrl: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  network: networkSchema,
  wallet: walletSchema.pick({ id: true, label: true, provider: true, address: true }),
  buyer: buyerSchema,
  // receipt snapshot: frozen at creation, never recomputed from the catalog
  items: quoteSchema.shape.items,
  subtotalEth: ethString,
  discountEth: ethString,
  networkFeeEth: ethString,
  totalEth: ethString,
  couponCode: z.string().nullable(),
})
export type Order = z.infer<typeof orderSchema>

// ---------- realtime ----------
export const nftUpdatedSchema = z.object({
  eventId: z.string(),
  type: z.literal('nft.updated'),
  resource: z.object({ type: z.literal('nft'), id: z.string() }),
  version: z.number().int(),
  occurredAt: z.string(),
  data: z.object({ listPriceEth: ethString, editions: z.array(editionSchema), reason: z.enum(['price', 'availability']) }),
})
export const orderUpdatedSchema = z.object({
  eventId: z.string(),
  type: z.literal('order.updated'),
  resource: z.object({ type: z.literal('order'), id: z.string() }),
  version: z.number().int(),
  occurredAt: z.string(),
  userId: z.string(),
  data: z.object({ status: orderStatusSchema, txHash: z.string().nullable(), explorerUrl: z.string().nullable(), rejectionReason: z.string().nullable() }),
})
export type NftUpdatedEvent = z.infer<typeof nftUpdatedSchema>
export type OrderUpdatedEvent = z.infer<typeof orderUpdatedSchema>
export type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent

// ---------- display labels (shared by the UI and the simulated backend) ----------
export const NETWORK_LABEL: Record<Network, string> = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }
export const PROVIDER_LABEL: Record<WalletProvider, string> = { walletconnect: 'WalletConnect', metamask: 'MetaMask', coinbase: 'Coinbase Wallet' }
