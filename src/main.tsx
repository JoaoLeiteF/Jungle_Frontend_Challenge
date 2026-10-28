import '@/styles/index.css'

async function boot() {
  const mocks = import.meta.env.VITE_ENABLE_MOCKS !== 'false' ? import('@/mocks/browser').then((m) => m.startMocks()) : Promise.resolve()
  const app = import('@/app/mount')
  const [{ mount }] = await Promise.all([app, mocks])
  mount(document.getElementById('root')!)
}

boot()
