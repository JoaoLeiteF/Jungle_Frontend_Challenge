import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export function NotFoundPage({ title = 'Página não encontrada', message = 'O endereço acessado não existe ou foi removido.' }: { title?: string; message?: string }) {
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center gap-4 py-24 text-center">
      <p className="text-5xl font-bold text-brand" aria-hidden>
        404
      </p>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-sand">{message}</p>
      <Button asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </section>
  )
}
