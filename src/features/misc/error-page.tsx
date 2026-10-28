import type { ErrorComponentProps } from '@tanstack/react-router'
import { useRouter } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, RotateCw } from 'lucide-react'
import { ReturnCountdown } from '@/components/return-countdown'
import { useGoBack } from '@/lib/use-go-back'
import { Button } from '@/components/ui/button'

export function ErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const back = useGoBack()
  const retry = async () => {
    await router.invalidate()
    reset()
  }
  return (
    <section role="alert" className="mx-auto flex min-h-[60dvh] w-full max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center animate-in fade-in duration-300">
      <span aria-hidden className="grid size-16 place-items-center rounded-full bg-surface-card text-brand ring-1 ring-line">
        <AlertTriangle className="size-7" />
      </span>
      <h1 className="text-2xl font-bold">Algo deu errado</h1>
      <p className="text-sm leading-6 text-sand">Esta tela encontrou um erro inesperado. Nenhuma compra ou alteração foi feita. Vamos levar você de volta para onde estava.</p>
      <div className="mt-2 flex w-full justify-center">
        <ReturnCountdown ms={5000} onDone={back} />
      </div>
      <div className="mt-2 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Button onClick={back} className="max-sm:h-11">
          <ArrowLeft aria-hidden /> Voltar
        </Button>
        <Button variant="outline" onClick={retry} className="max-sm:h-11">
          <RotateCw aria-hidden /> Tentar novamente
        </Button>
      </div>
      <details className="mt-4 w-full rounded-md border border-line bg-surface-card px-4 py-3 text-left text-xs text-sand">
        <summary className="cursor-pointer font-bold text-cream">Detalhes técnicos</summary>
        <code className="mt-2 block break-words">{error instanceof Error ? error.message : String(error)}</code>
      </details>
    </section>
  )
}
