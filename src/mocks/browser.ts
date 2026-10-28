import { setupWorker } from 'msw/browser'
import { db, loadDb, resetDb } from './db'
import { handlers, resumePendingOrders, touchNft } from './handlers'
import { outage, peerCount, realtimeHandler, replayLast, replayStale } from './realtime'
import { initScenario, scenario, setScenario, type ScenarioName } from './scenarios'
import { addEth } from '@/lib/eth'

/** Test/demo control surface. Every action mutates the simulated backend, never the UI. */
const control = {
  setScenario: (name: ScenarioName) => setScenario(name),
  scenario,
  reset: async () => {
    await resetDb()
    setScenario('default')
  },
  /** Raises the price of an NFT edition and emits `nft.updated` through the socket server. */
  changePrice: (nftId: string, edition = 3, deltaEth = '0.05') => {
    const nft = db.nfts.find((n) => n.id === nftId)
    const ed = nft?.editions.find((e) => e.edition === edition)
    if (!nft || !ed) throw new Error(`unknown ${nftId}/${edition}`)
    ed.priceEth = addEth(ed.priceEth, deltaEth)
    touchNft(nft, 'price')
    return ed.priceEth
  },
  setAvailability: (nftId: string, edition: number, available: number) => {
    const nft = db.nfts.find((n) => n.id === nftId)
    const ed = nft?.editions.find((e) => e.edition === edition)
    if (!nft || !ed) throw new Error(`unknown ${nftId}/${edition}`)
    ed.available = available
    touchNft(nft, 'availability')
  },
  expireSessions: () => {
    db.sessions = []
  },
  replayLastEvent: replayLast,
  replayStaleEvent: replayStale,
  outage,
  peerCount,
}

declare global {
  interface Window {
    __kurioMock?: typeof control
  }
}

const HEALTH_URL = `${import.meta.env.VITE_API_URL ?? '/api'}/__mock/health`
const HEALTH_EVERY_MS = 2000

/**
 * Browsers stop idle service workers. MSW's worker keeps its activated clients in memory only, so
 * after a restart it silently passes every request through to the network (on Vercel that is the
 * SPA's index.html). Probe a mocked endpoint and redo the activation handshake when it stops answering.
 */
function keepMocksAlive(worker: ReturnType<typeof setupWorker>, options: Parameters<ReturnType<typeof setupWorker>['start']>[0]) {
  let healing = false
  // MSW deregisters the tab on beforeunload: a probe after that would wrongly look like a dead worker.
  let leaving = false
  window.addEventListener('beforeunload', () => (leaving = true))
  window.addEventListener('pageshow', () => (leaving = false))
  const check = async () => {
    if (healing || leaving || document.visibilityState !== 'visible') return
    const healthy = await fetch(HEALTH_URL, { cache: 'no-store' })
      .then(async (r) => r.ok && (await r.json()).ok === true)
      .catch(() => false)
    if (healthy || leaving) return
    healing = true
    try {
      worker.stop()
      await worker.start(options)
    } finally {
      healing = false
    }
  }
  setInterval(check, HEALTH_EVERY_MS)
  document.addEventListener('visibilitychange', check)
  window.addEventListener('focus', check)
}

export async function startMocks() {
  await loadDb()
  initScenario()
  resumePendingOrders()
  window.__kurioMock = control
  const worker = setupWorker(...handlers, realtimeHandler)
  const options = {
    onUnhandledRequest: 'bypass' as const,
    quiet: import.meta.env.PROD,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  }
  await worker.start(options)
  keepMocksAlive(worker, options)
}
