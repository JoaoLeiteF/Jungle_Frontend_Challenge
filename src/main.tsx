import '@/styles/index.css'

async function boot() {
  // The simulated backend must be listening before the first request goes out, so rendering waits for
  // it — but the app and route chunks download in parallel instead of after it. This is safe because
  // nothing in the app graph captures globalThis.WebSocket at import time (socket.io-client is loaded
  // lazily inside RealtimeBridge, after MSW has patched WebSocket).
  const mocks = import.meta.env.VITE_ENABLE_MOCKS !== 'false' ? import('@/mocks/browser').then((m) => m.startMocks()) : Promise.resolve()
  const app = import('@/app/mount')
  const [{ mount }] = await Promise.all([app, mocks])
  mount(document.getElementById('root')!)
}

boot()
