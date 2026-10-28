import { AlertTriangle, Loader2, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div aria-hidden className={cn('skeleton rounded-md', className)} {...props} />
}

export function ErrorState({ title = 'Algo deu errado', message, onRetry, retrying, className }: { title?: string; message?: string; onRetry?: () => void; retrying?: boolean; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-lg border border-line bg-surface-card px-6 py-10 text-center animate-in fade-in duration-300', className)}>
      <AlertTriangle className="size-6 text-brand" aria-hidden />
      <p className="font-bold">{title}</p>
      {message && <p className="max-w-md text-sm text-sand">{message}</p>}
      {onRetry && (
        <Button onClick={onRetry} loading={retrying} className="mt-2">
          {!retrying && <RotateCw aria-hidden />} {retrying ? 'Tentando…' : 'Tentar novamente'}
        </Button>
      )}
    </div>
  )
}

export function EmptyState({ title, children, className }: { title: string; children?: React.ReactNode; className?: string }) {
  return (
    <div role="status" className={cn('flex flex-col items-center gap-3 rounded-lg border border-dashed border-line-soft px-6 py-12 text-center animate-in fade-in duration-300', className)}>
      <p className="font-bold">{title}</p>
      {children && <div className="text-sm text-sand">{children}</div>}
    </div>
  )
}

export function RefreshingHint({ show }: { show: boolean }) {
  return (
    <span role="status" aria-live="polite" className={cn('inline-flex items-center gap-1.5 text-xs text-sand transition-opacity duration-300', show ? 'opacity-100' : 'opacity-0')}>
      {show && <Loader2 className="size-3 animate-spin text-brand" aria-hidden />}
      {show ? 'Atualizando…' : ''}
    </span>
  )
}
