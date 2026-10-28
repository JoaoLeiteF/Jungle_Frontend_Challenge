import { getRouteApi, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

const route = getRouteApi('/em-breve')

/** Editorial, support, activity, offers and downloads are out of scope: say so instead of faking success. */
export function ComingSoonPage() {
  const { secao } = route.useSearch()
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-bold">{secao ?? 'Esta seção'} chega em breve</h1>
      <p className="text-sand">Esta área ainda não faz parte da Kurio. Nada foi enviado ou alterado.</p>
      <Button asChild>
        <Link to="/" hash="catalogo">
          Explorar o mercado
        </Link>
      </Button>
    </section>
  )
}
