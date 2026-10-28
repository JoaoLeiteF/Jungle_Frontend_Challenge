import { useEffect, useState } from 'react'

/** Visible countdown back to the previous page; the visitor can always cancel it (WCAG 2.2.1). */
export function ReturnCountdown({ ms, onDone }: { ms: number; onDone: () => void }) {
  const [elapsed, setElapsed] = useState(0)
  const [stopped, setStopped] = useState(false)
  useEffect(() => {
    if (stopped) return
    const start = Date.now()
    const t = setInterval(() => setElapsed(Math.min(Date.now() - start, ms)), 100)
    return () => clearInterval(t)
  }, [ms, stopped])
  useEffect(() => {
    if (!stopped && elapsed >= ms) onDone()
  })
  if (stopped) return <p className="text-xs text-sand">Retorno automático cancelado.</p>
  const total = Math.round(ms / 1000)
  const seconds = Math.ceil((ms - elapsed) / 1000)
  return (
    <div className="w-full max-w-xs">
      <div role="progressbar" aria-label="Voltando para a página anterior" aria-valuemin={0} aria-valuemax={total} aria-valuenow={total - seconds} className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
        <div className="h-full rounded-full bg-brand transition-[width] duration-100 ease-linear" style={{ width: `${(elapsed / ms) * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-sand tabular-nums">
        Voltando para a página anterior em {seconds}s ·{' '}
        <button type="button" onClick={() => setStopped(true)} className="font-bold text-highlight underline-offset-2 hover:underline">
          Ficar nesta página
        </button>
      </p>
    </div>
  )
}
