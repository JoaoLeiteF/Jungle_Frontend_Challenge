import { useEffect } from 'react'
import { Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { MobileNav } from '@/components/mobile-nav'
import { MockPanel } from '@/components/mock-panel'
import { RealtimeBridge } from '@/realtime/bridge'
import { useSession } from './session'

const PRIVATE = ['/checkout', '/orders', '/profile']

/** When the session expires on a private screen, send the user to login and bring them back after. */
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
  // Mobile auth screens are full-screen in the Figma (no chrome)
  const bare = pathname === '/login' || pathname === '/register'
  return (
    <>
      <a href="#conteudo" className="sr-only z-50 rounded bg-brand px-3 py-2 text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Pular para o conteúdo
      </a>
      <div className={bare ? 'max-md:hidden' : undefined}>
        <Header />
      </div>
      <main id="conteudo" tabIndex={-1} className="mx-auto flow-root min-h-[100dvh] w-full max-w-[1200px] px-4 pb-24 outline-none md:px-6 md:pb-0 xl:px-0">
        <Outlet />
      </main>
      <div className={bare ? 'max-md:hidden' : undefined}>
        <Footer />
      </div>
      {!bare && <MobileNav />}
      <Toaster position="bottom-right" closeButton richColors={false} />
      <RealtimeBridge />
      <SessionWatcher />
      {import.meta.env.VITE_ENABLE_MOCKS !== 'false' && <MockPanel />}
    </>
  )
}
