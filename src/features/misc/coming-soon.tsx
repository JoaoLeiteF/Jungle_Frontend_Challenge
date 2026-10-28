import { useEffect, useRef, useState } from 'react'
import { getRouteApi, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

const route = getRouteApi('/em-breve')
const RETURN_MS = 8000

export function ComingSoonPage() {
  const { secao } = route.useSearch()
  const router = useRouter()
  const navigate = useNavigate()
  const [elapsed, setElapsed] = useState(0)
  const left = useRef(false)
  const back = () => {
    if (left.current) return
    left.current = true
    if (router.history.canGoBack()) router.history.back()
    else navigate({ to: '/' })
  }

  useEffect(() => {
    const start = Date.now()
    const t = setInterval(() => setElapsed(Math.min(Date.now() - start, RETURN_MS)), 100)
    return () => clearInterval(t)
  }, [])
  useEffect(() => {
    if (elapsed >= RETURN_MS) back()
  })

  const seconds = Math.ceil((RETURN_MS - elapsed) / 1000)
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-bold">{secao ?? 'Esta seção'} chega em breve</h1>
      <p className="text-sand">Esta área ainda não faz parte da Kurio. Nada foi enviado ou alterado.</p>
      <div className="mt-2 w-full max-w-xs">
        <div role="progressbar" aria-label="Voltando para a página anterior" aria-valuemin={0} aria-valuemax={8} aria-valuenow={8 - seconds} className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
          <div className="h-full rounded-full bg-brand transition-[width] duration-100 ease-linear" style={{ width: `${(elapsed / RETURN_MS) * 100}%` }} />
        </div>
        <p className="mt-2 text-xs text-sand tabular-nums">Voltando para a página anterior em {seconds}s</p>
      </div>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Button onClick={back}>
          <ArrowLeft aria-hidden /> Voltar
        </Button>
        <Button asChild variant="outline">
          <Link to="/" hash="catalogo">
            Explorar o mercado
          </Link>
        </Button>
      </div>
    </section>
  )
}
