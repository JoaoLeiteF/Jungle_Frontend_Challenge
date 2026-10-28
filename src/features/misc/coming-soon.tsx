import { getRouteApi, Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { ReturnCountdown } from '@/components/return-countdown'
import { useGoBack } from '@/lib/use-go-back'
import { Button } from '@/components/ui/button'

const route = getRouteApi('/em-breve')

export function ComingSoonPage() {
  const { secao } = route.useSearch()
  const back = useGoBack()
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-bold">{secao ?? 'Esta seção'} chega em breve</h1>
      <p className="text-sand">Esta área ainda não faz parte da Kurio. Nada foi enviado ou alterado.</p>
      <div className="mt-2 flex w-full justify-center">
        <ReturnCountdown ms={8000} onDone={back} />
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
