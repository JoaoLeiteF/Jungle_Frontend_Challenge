import { useEffect, useState } from 'react'

export function ReturnCountdown({ ms, onDone }: { ms: number; onDone: () => void }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const t = setInterval(() => setElapsed(Math.min(Date.now() - start, ms)), 100)
    return () => clearInterval(t)
  }, [ms])
  useEffect(() => {
    if (elapsed >= ms) onDone()
  })
  const total = Math.round(ms / 1000)
  const seconds = Math.ceil((ms - elapsed) / 1000)
  return (
    <div className="w-full max-w-xs">
      <div role="progressbar" aria-label="Voltando para a página anterior" aria-valuemin={0} aria-valuemax={total} aria-valuenow={total - seconds} className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
        <div className="h-full rounded-full bg-brand transition-[width] duration-100 ease-linear" style={{ width: `${(elapsed / ms) * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-sand tabular-nums">Voltando para a página anterior em {seconds}s</p>
    </div>
  )
}
