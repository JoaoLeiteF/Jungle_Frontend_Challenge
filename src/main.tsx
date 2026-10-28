import '@/styles/index.css'

async function boot() {
  // The simulated backend must be listening before the app modules load: engine.io-client captures
  // globalThis.WebSocket at import time, so MSW has to patch it first or the socket bypasses the mock.
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'false') {
    const { startMocks } = await import('@/mocks/browser')
    await startMocks()
  }
  const { mount } = await import('@/app/mount')
  mount(document.getElementById('root')!)
}

boot()
