// Simulated backend state. One object holds catalog, users, sessions, carts, favorites, wallets and
// orders so REST handlers and socket events always read the same truth. Persisted to localStorage so
// refresh keeps the scenario; reset() restores the deterministic seed.
import type { Collection, Edition, Network, Nft, Order, Quote, User, Wallet, WalletProvider } from '@/api/contracts'
import { COLLECTIONS } from '@/api/contracts'
import { fromWei, toWei } from '@/lib/eth'

export interface DbUser extends User {
  passwordHash: string
  salt: string
}
export interface DbSession {
  token: string
  userId: string
  expiresAt: number
  connectedWalletId?: string | null
}
export interface DbCartItem {
  id: string
  nftId: string
  edition: number
  quantity: number
}
export interface DbCart {
  id: string
  items: DbCartItem[]
  couponCode: string | null
  updatedAt: string
}
export interface DbQuote extends Quote {
  cartId: string
  userId: string
}
export interface DbIdempotency {
  key: string
  userId: string
  bodyHash: string
  orderId: string
}
export interface DbOrder extends Order {
  userId: string
  purchased: { nftId: string; edition: number; quantity: number }[]
}

export interface Db {
  seedVersion: number
  nfts: Nft[]
  users: DbUser[]
  sessions: DbSession[]
  carts: Record<string, DbCart> // guest carts by X-Cart-Id, user carts by `user:<id>`
  favorites: Record<string, string[]>
  wallets: (Wallet & { userId: string })[]
  quotes: Record<string, DbQuote>
  orders: DbOrder[]
  idempotency: DbIdempotency[]
  counters: { id: number; event: number }
}

export const COUPONS: Record<string, { percentOff: number; expiresAt: string }> = {
  KURIO10: { percentOff: 10, expiresAt: '2099-12-31T23:59:59Z' },
  GENESIS25: { percentOff: 25, expiresAt: '2099-12-31T23:59:59Z' },
  EXPIRED5: { percentOff: 5, expiresAt: '2024-01-01T00:00:00Z' },
}

export const SEED_PASSWORD = 'Kurio@123'
export const SEED_USERS = [
  { id: 'u_ana', email: 'ana@kurio.test', username: 'ana.souza', displayName: 'Ana Souza', ensName: 'ana', referralCode: 'ANA2026' },
  { id: 'u_bruno', email: 'bruno@kurio.test', username: 'bruno.lima', displayName: 'Bruno Lima', ensName: null, referralCode: null },
] as const

const STORAGE_KEY = 'kurio.mockdb.v1'
const SEED_VERSION = 3
// Fixed epoch so "Novos lançamentos" ordering and createdAt are deterministic.
const EPOCH = Date.UTC(2026, 9, 1)

// ---------- deterministic randomness ----------
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
export const hashPassword = (password: string, salt: string) => sha256(`${salt}:${password}`)

// ---------- catalog seed ----------
const ART = {
  ape: { image: 'emerald-ape', names: ['Emerald Ape', 'Jade Monarch', 'Velvet Ape', 'Copper Drift', 'Forest Regent'], attrs: ['Óculos', 'Esmeralda', 'Raro'] },
  nomad: { image: 'sage-nomad', names: ['Sage Nomad', 'Cosmic Bloom', 'Violet Nomad', 'Lilac Wanderer', 'Moss Pilgrim'], attrs: ['Chapéu', 'Moletom', 'Lendário'] },
  vessel: { image: 'neon-vessel', names: ['Neon Vessel', 'Ivory Baron', 'Onyx Regent', 'Night Curator', 'Slate Envoy'], attrs: ['Gola alta', 'Brinco', 'Épico'] },
  beat: { image: 'golden-beat', names: ['Golden Beat', 'Golden Frequency', 'Golden Signal', 'Amber Pulse', 'Honey Echo'], attrs: ['Headphone', 'Dourado', 'Incomum'] },
} as const
type ArtKey = keyof typeof ART

const COLLECTION_NAMES: Record<Collection, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}
export const collectionLabel = (c: Collection) => COLLECTION_NAMES[c]
const NETWORK_NAMES: Record<Network, string> = { ethereum: 'Ethereum', polygon: 'Polygon', solana: 'Solana' }
export const networkLabel = (n: Network) => NETWORK_NAMES[n]

// The first nine reproduce the Figma catalog page one-to-one.
const FIGMA_FIRST: { art: ArtKey; name: string; token: string; price: string; compareAt?: string }[] = [
  { art: 'ape', name: 'Emerald Ape', token: '042', price: '1.19' },
  { art: 'nomad', name: 'Sage Nomad', token: '009', price: '1.69' },
  { art: 'vessel', name: 'Neon Vessel', token: '552', price: '1.99', compareAt: '2.29' },
  { art: 'nomad', name: 'Cosmic Bloom', token: '118', price: '1.29' },
  { art: 'nomad', name: 'Violet Nomad', token: '314', price: '1.39' },
  { art: 'vessel', name: 'Ivory Baron', token: '088', price: '1.79' },
  { art: 'beat', name: 'Golden Beat', token: '207', price: '0.99' },
  { art: 'beat', name: 'Golden Frequency', token: '071', price: '0.59' },
  { art: 'beat', name: 'Golden Signal', token: '160', price: '0.39' },
]

const EDITION_TIERS = [
  { label: '1/1', supply: 1, mult: 400n },
  { label: '1/10', supply: 10, mult: 180n },
  { label: '1/50', supply: 50, mult: 100n },
  { label: 'Aberta', supply: 500, mult: 60n },
] as const

function buildEditions(baseEth: string, rnd: () => number, i: number): Edition[] {
  const base = toWei(baseEth)
  // "1/50" is the reference tier (the Figma price); others scale from it. Tier 1/1 is sold out
  // on a third of the catalog so "edição indisponível" is exercised.
  return EDITION_TIERS.map((t, idx) => {
    const price = (base * t.mult) / 100n
    const available = idx === 0 && i % 3 === 0 ? 0 : Math.max(1, Math.round(t.supply * (0.3 + rnd() * 0.7)))
    return {
      edition: idx + 1,
      label: t.label,
      priceEth: fromWei(price - (price % 10n ** 14n)), // 4 decimals max
      available,
      maxPerOrder: Math.min(t.supply, idx === 0 ? 1 : idx === 1 ? 3 : 10),
    }
  })
}

function makeNft(i: number, art: ArtKey, name: string, token: string, price: string, compareAt: string | null, rnd: () => number): Nft {
  const collection = i < 9 ? (['arte-digital', 'colecionaveis', 'generativa'] as const)[i % 3]! : COLLECTIONS[Math.floor(rnd() * COLLECTIONS.length)]!
  const network: Network = i < 9 ? 'ethereum' : (['ethereum', 'polygon', 'solana'] as const)[Math.floor(rnd() * 3)]!
  const editions = buildEditions(price, rnd, i)
  // Card price = the default "1/50" edition, exactly as the Figma card and detail show it.
  const listPrice = editions[2]!.priceEth
  const full = `${name} #${token}`
  const reviewCount = 4 + Math.floor(rnd() * 30)
  return {
    id: `${name.toLowerCase().replace(/\s+/g, '-')}-${token}`,
    name: full,
    tokenId: `#${token.padStart(4, '0')}`,
    collection,
    collectionName: collectionLabel(collection),
    network,
    image: ART[art].image,
    description: `Um colecionável digital finalizado à mão da coleção Kurio Editions, verificado na ${networkLabel(network)}, com arte desbloqueável e acesso para colecionadores.`,
    creator: ['Nova Sato', 'Lia Prado', 'Theo Ramos', 'Kai Mendes'][i % 4]!,
    attributes: [...ART[art].attrs],
    rating: Math.round((3.8 + rnd() * 1.2) * 10) / 10,
    reviewCount,
    listPriceEth: listPrice,
    compareAtEth: compareAt,
    editions,
    contractAddress: `0x7A42${(i * 2654435761).toString(16).padStart(8, '0').slice(0, 8).toUpperCase()}19E8`,
    royaltyPercent: 5,
    createdAt: new Date(EPOCH - i * 36e5 * 7).toISOString(),
    trendingScore: Math.round(rnd() * 1000),
    version: 1,
  }
}

function seedNfts(): Nft[] {
  const rnd = mulberry32(20261027)
  const nfts = FIGMA_FIRST.map((f, i) => makeNft(i, f.art, f.name, f.token, f.price, f.compareAt ?? null, rnd))
  const arts = Object.keys(ART) as ArtKey[]
  for (let i = 9; i < 60; i++) {
    const art = arts[i % 4]!
    const name = ART[art].names[Math.floor(rnd() * 5)]!
    const token = String(100 + ((i * 37) % 900))
    const price = (0.05 + rnd() * 12.25).toFixed(2)
    const compareAt = rnd() < 0.15 ? (Number(price) * 1.15).toFixed(2) : null
    nfts.push(makeNft(i, art, name, token, price, compareAt, rnd))
  }
  return nfts
}

const REVIEW_TEXTS = [
  'Arte impecável e entrega instantânea na carteira.',
  'A procedência registrada me deu muita confiança.',
  'Detalhes incríveis em alta resolução.',
  'Comprei a edição aberta e já quero a 1/10.',
  'Comunidade ativa e criador muito presente.',
]
export function reviewsFor(nft: Nft) {
  const rnd = mulberry32(nft.id.length * 7919 + nft.reviewCount)
  return Array.from({ length: Math.min(nft.reviewCount, 5) }, (_, k) => ({
    id: `${nft.id}-r${k}`,
    author: ['Marina', 'Diego', 'Yuki', 'Rafa', 'Leo'][k]!,
    rating: 4 + Math.round(rnd()),
    text: REVIEW_TEXTS[k]!,
    createdAt: new Date(EPOCH - k * 864e5 * 3).toISOString(),
  }))
}

function seedWallet(userId: string, id: string, label: string, provider: WalletProvider, address: string, owner: string, email: string): Wallet & { userId: string } {
  return { id, userId, role: 'primary', label, provider, network: 'ethereum', address, ensName: null, ownerName: owner, email, referralCode: null, updatedAt: new Date(EPOCH).toISOString() }
}

async function seed(): Promise<Db> {
  const users: DbUser[] = []
  for (const u of SEED_USERS) {
    const salt = `salt_${u.id}`
    users.push({ ...u, avatarUrl: null, salt, passwordHash: await hashPassword(SEED_PASSWORD, salt) })
  }
  return {
    seedVersion: SEED_VERSION,
    nfts: seedNfts(),
    users,
    sessions: [],
    carts: {},
    favorites: { u_ana: ['emerald-ape-042'] },
    // Ana has a primary wallet; Bruno has none (exercises the "cadastre uma carteira" path)
    wallets: [
      seedWallet('u_ana', 'w_ana_1', 'Principal', 'metamask', '0x8A3f5C2b9D1e4F6a7B8c9D0e1F2a3B4c5D6e7F80', 'Ana Souza', 'ana@kurio.test'),
      { ...seedWallet('u_ana', 'w_ana_2', 'Reserva', 'coinbase', '0x1B2c3D4e5F6a7B8c9D0e1F2a3B4c5D6e7F8a9B0C', 'Ana Souza', 'ana@kurio.test'), role: 'secondary', network: 'polygon' },
    ],
    quotes: {},
    orders: [],
    idempotency: [],
    counters: { id: 1000, event: 0 },
  }
}

// ---------- persistence ----------
export let db: Db

export async function loadDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Db
      if (parsed.seedVersion === SEED_VERSION) {
        db = parsed
        return
      }
    }
  } catch {
    /* corrupted or blocked storage → reseed */
  }
  db = await seed()
  persist()
}

export function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    /* storage full/blocked: state still lives in memory for this tab */
  }
}

export async function resetDb() {
  db = await seed()
  persist()
}

export const nextId = (prefix: string) => `${prefix}_${++db.counters.id}`
export const nextEventId = () => `evt_${++db.counters.event}`
