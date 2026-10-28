import { lazy, Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { Footer } from '@/components/footer'
import { Header } from './shell/header'
import { MobileNav } from './shell/mobile-nav'
import { TopLoader } from '@/components/top-loader'
import { RealtimeBridge } from '@/realtime/bridge'
import { useSession } from './session'

// Demo tooling: only fetched when the simulated backend is on.
const MockPanel = lazy(() => import('@/devtools/mock-panel').then((m) => ({ default: m.MockPanel })))

const PRIVATE = ['/checkout', '/orders', '/profile']

function SessionWatcher() {
  const s = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (s.status === 'anonymous' && s.expired && PRIVATE.some((p) => location.pathname.startsWith(p)))
      navigate({ to: '/login', search: { redirect: location.href }, replace: true })
  }, [s, location.pathname, location.href, navigate])
  return null
}

export function RootLayout() {
  const { pathname } = useLocation()
  const bare = pathname === '/login' || pathname === '/register'
  const section = pathname.split('/')[1]
  const [initial] = useState(section)
  const [navigated, setNavigated] = useState(false)
  if (!navigated && section !== initial) setNavigated(true)
  return (
    <>
      <TopLoader />
      <a href="#conteudo" className="sr-only z-50 rounded bg-brand px-3 py-2 text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Pular para o conteúdo
      </a>
      <div className={bare ? 'max-md:hidden' : undefined}>
        <Header />
      </div>
      <main id="conteudo" tabIndex={-1} className="mx-auto flow-root min-h-[100dvh] w-full max-w-[1200px] px-4 pb-24 outline-none md:px-6 md:pb-0 xl:px-0">
        <div key={section} className={navigated ? 'animate-in fade-in duration-300 ease-out' : undefined}>
          <Outlet />
        </div>
      </main>
      <div className={bare ? 'max-md:hidden' : undefined}>
        <Footer />
      </div>
      {!bare && <MobileNav />}
      <Toaster position="bottom-right" closeButton richColors={false} />
      <RealtimeBridge />
      <SessionWatcher />
      {import.meta.env.VITE_ENABLE_MOCKS !== 'false' && (
        <Suspense fallback={null}>
          <MockPanel />
        </Suspense>
      )}
    </>
  )
}
