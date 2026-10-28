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

export async function startMocks() {
  await loadDb()
  initScenario()
  resumePendingOrders()
  window.__kurioMock = control
  await setupWorker(...handlers, realtimeHandler).start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
}
