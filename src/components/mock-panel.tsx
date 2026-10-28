import { useEffect, useState } from 'react'
import { FlaskConical, X } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { http } from '@/api/client'
import { session } from '@/app/session'

type Info = { scenario: string; available: Record<string, string> }

export function MockPanel() {
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<Info | null>(null)
  const qc = useQueryClient()

  useEffect(() => {
    if (open) http.get<Info>('/__mock/scenario').then((r) => setInfo(r.data), () => setInfo(null))
  }, [open])

  async function choose(scenario: string) {
    const r = await http.put<{ scenario: string }>('/__mock/scenario', { scenario })
    setInfo((i) => (i ? { ...i, scenario: r.data.scenario } : i))
    await qc.invalidateQueries()
  }
  async function reset() {
    await http.post('/__mock/reset')
    await session.logout()
    location.assign('/')
  }

  return (
    <div className="fixed bottom-20 left-3 z-50 md:bottom-4">
      {open ? (
        <section aria-label="Cenários de simulação" className="w-72 rounded-lg border border-line-soft bg-surface-card p-3 text-xs shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Cenário do mock</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar painel de cenários" className="rounded p-1 hover:bg-surface-raised">
              <X className="size-4" />
            </button>
          </div>
          {info ? (
            <>
              <label htmlFor="mock-scenario" className="sr-only">
                Cenário
              </label>
              <select id="mock-scenario" value={info.scenario} onChange={(e) => choose(e.target.value)} className="w-full rounded border border-line-soft bg-ink p-2">
                {Object.entries(info.available).map(([k, v]) => (
                  <option key={k} value={k}>
                    {k} — {v}
                  </option>
                ))}
              </select>
              <button type="button" onClick={reset} className="mt-2 w-full rounded border border-brand p-2 text-brand hover:bg-brand hover:text-ink">
                Resetar dados e sessão
              </button>
              <p className="mt-2 leading-4 text-sand">Também via <code>?scenario=</code> na URL ou <code>window.__kurioMock</code>.</p>
            </>
          ) : (
            <p className="text-sand">Mocks indisponíveis.</p>
          )}
        </section>
      ) : (
        <button type="button" onClick={() => setOpen(true)} aria-label="Abrir painel de cenários do mock" className="grid size-10 place-items-center rounded-full border border-line-soft bg-surface-card text-highlight shadow-lg hover:bg-surface-raised">
          <FlaskConical className="size-5" />
        </button>
      )}
    </div>
  )
}
