import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { FlaskConical, Loader2, RotateCcw, X } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { http } from '@/api/client'
import { api } from '@/api/endpoints'
import { session } from '@/app/session'
import { cn } from '@/lib/utils'

const infoSchema = z.object({ scenario: z.string(), available: z.record(z.string(), z.string()) })
type Info = z.infer<typeof infoSchema>

async function withRetry<T>(run: () => Promise<T>, tries = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await run()
    } catch (e) {
      if (i >= tries) throw e
      await new Promise((r) => setTimeout(r, 1500))
    }
  }
}

type Need = 'login' | 'cart'
/** Scenarios that only show on one screen: the panel prepares the case and opens that screen. */
const CASES: Record<string, { to: '/' | '/cart' | '/checkout' | '/profile'; screen: string; hint: string; needs?: Need[] }> = {
  empty: { to: '/', screen: 'Início', hint: 'O catálogo aparece vazio.' },
  slow: { to: '/', screen: 'Início', hint: 'Cada requisição leva de 1,5 a 3 s: veja os skeletons.' },
  jitter: { to: '/', screen: 'Início', hint: 'Troque filtros rápido: só a última consulta aparece.' },
  offline: { to: '/', screen: 'Início', hint: 'Toda a API falha como erro de rede.' },
  'error-500': { to: '/', screen: 'Início', hint: 'Catálogo e detalhe respondem 500: use “Tentar novamente”.' },
  'flaky-503': { to: '/', screen: 'Início', hint: 'A 1ª tentativa falha e o retry automático recupera.' },
  'favorites-fail': { to: '/', screen: 'Início', needs: ['login'], hint: 'Favorite um NFT: o coração volta ao estado anterior.' },
  'session-expired': { to: '/profile', screen: 'Perfil', needs: ['login'], hint: 'Em 20 s a sessão expira; navegue para ser levado ao login.' },
  'price-change': { to: '/cart', screen: 'Carrinho', needs: ['cart'], hint: 'Em 4 s o preço do 1º item sobe 0.05 ETH.' },
  'sold-out': { to: '/cart', screen: 'Carrinho', needs: ['cart'], hint: 'Em 4 s a edição do 1º item esgota.' },
  'order-timeout': { to: '/checkout', screen: 'Pagamento', needs: ['login', 'cart'], hint: 'Conecte a carteira e confirme: a resposta demora 12 s.' },
  'payment-declined': { to: '/checkout', screen: 'Pagamento', needs: ['login', 'cart'], hint: 'Conecte a carteira e confirme: o pagamento é recusado.' },
  'wallet-rejected': { to: '/checkout', screen: 'Pagamento', needs: ['login', 'cart'], hint: 'Clique em conectar: a carteira recusa a conexão.' },
}
const DEMO_USER = { email: 'ana@kurio.test', password: 'Kurio@123' }

async function prepare(needs: Need[] = []) {
  if (needs.includes('login') && session.get().status !== 'authenticated') await session.login(DEMO_USER)
  if (needs.includes('cart') && (await api.cart.get()).items.length === 0) await api.cart.add({ nftId: 'emerald-ape-042', edition: 3, quantity: 1 })
}

const fetchInfo = () => withRetry(async () => infoSchema.parse((await http.get('/__mock/scenario')).data))

export function MockPanel() {
  const [open, setOpen] = useState(false)
  const [info, setInfo] = useState<Info | null>(null)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('loading')
  const [busy, setBusy] = useState<string | null>(null)
  const qc = useQueryClient()
  const router = useRouter()

  const settle = (p: Promise<Info>) =>
    p.then(
      (i) => (setInfo(i), setState('idle')),
      () => setState('error'),
    )
  const load = () => {
    setState('loading')
    settle(fetchInfo())
  }
  useEffect(() => {
    settle(fetchInfo())
  }, [])

  const dropScenarioFromUrl = () => {
    const url = new URL(location.href)
    if (!url.searchParams.has('scenario')) return
    url.searchParams.delete('scenario')
    router.history.replace(url.pathname + url.search + url.hash)
  }

  async function choose(scenario: string) {
    setBusy(scenario)
    try {
      const r = await withRetry(() => http.put('/__mock/scenario', { scenario }))
      const active = z.object({ scenario: z.string() }).parse(r.data).scenario
      setInfo((i) => (i ? { ...i, scenario: active } : i))
      dropScenarioFromUrl()
      const kase = CASES[active]
      await prepare(kase?.needs)
      await qc.invalidateQueries()
      if (kase && location.pathname !== kase.to) await router.navigate({ to: kase.to })
      toast.success(`Cenário “${active}” ativado`, { description: kase?.hint ?? info?.available[active] })
    } catch {
      toast.error('Não foi possível trocar o cenário. Tente novamente.')
    } finally {
      setBusy(null)
    }
  }

  async function reset() {
    setBusy('reset')
    try {
      await withRetry(() => http.post('/__mock/reset'))
      await session.logout().catch(() => undefined)
      qc.clear()
      setInfo((i) => (i ? { ...i, scenario: 'default' } : i))
      dropScenarioFromUrl()
      await router.invalidate()
      toast.success('Dados e sessão restaurados. Cenário padrão ativo.')
    } catch {
      toast.error('Não foi possível resetar o mock. Tente novamente.')
    } finally {
      setBusy(null)
    }
  }

  const active = info?.scenario ?? 'default'
  return (
    <div className="fixed bottom-20 left-3 z-50 md:bottom-4">
      {open ? (
        <section aria-label="Cenários de simulação" className="flex max-h-[min(70dvh,560px)] w-[min(20rem,calc(100vw-1.5rem))] flex-col rounded-lg border border-line-soft bg-surface-card text-xs shadow-[0_16px_40px_-12px_rgb(0_0_0/0.8)] animate-in fade-in zoom-in-95 duration-200">
          <header className="flex items-center justify-between border-b border-line px-3 py-2">
            <h2 className="font-bold">Cenário do mock</h2>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fechar painel de cenários" className="rounded p-1 hover:bg-surface-raised">
              <X className="size-4" />
            </button>
          </header>
          {info ? (
            <>
              <div role="radiogroup" aria-label="Cenário" className="flex flex-col gap-1 overflow-y-auto p-2">
                {Object.entries(info.available).map(([name, description]) => {
                  const checked = name === info.scenario
                  return (
                    <button
                      key={name}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      disabled={!!busy}
                      onClick={() => !checked && choose(name)}
                      className={cn(
                        'flex items-start gap-2 rounded-md border px-2 py-1.5 text-left transition-colors disabled:cursor-progress',
                        checked ? 'border-brand bg-brand/10' : 'border-transparent hover:bg-surface-raised',
                      )}
                    >
                      <span aria-hidden className={cn('mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full border', checked ? 'border-brand' : 'border-sand-muted')}>
                        {busy === name ? <Loader2 className="size-3 animate-spin text-brand" /> : checked && <span className="size-1.5 rounded-full bg-brand" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className={cn('font-bold', checked && 'text-highlight')}>{name}</span>
                          {CASES[name] && <span className="shrink-0 rounded-full border border-line-soft px-1.5 text-[10px] leading-4 text-sand">{CASES[name].screen}</span>}
                        </span>
                        <span className="block leading-4 text-sand">{description}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <footer className="border-t border-line p-2">
                <button
                  type="button"
                  onClick={reset}
                  disabled={!!busy}
                  className="flex w-full items-center justify-center gap-2 rounded border border-brand p-2 font-bold text-brand transition-[background-color,color,transform] hover:bg-brand hover:text-ink active:scale-[0.98] disabled:cursor-progress disabled:opacity-60"
                >
                  {busy === 'reset' ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
                  Resetar dados e sessão
                </button>
                <p className="mt-2 leading-4 text-sand">
                  Também via <code>?scenario=</code> na URL ou <code>window.__kurioMock</code>.
                </p>
              </footer>
            </>
          ) : (
            <div role="status" className="flex flex-col items-center gap-2 p-4 text-center text-sand">
              {state === 'error' ? (
                <>
                  <p>Não foi possível falar com o servidor simulado.</p>
                  <button type="button" onClick={load} className="rounded border border-brand px-3 py-1 font-bold text-brand hover:bg-brand hover:text-ink">
                    Tentar novamente
                  </button>
                </>
              ) : (
                <p className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Conectando ao mock…
                </p>
              )}
            </div>
          )}
        </section>
      ) : (
        <button
          type="button"
          onClick={() => {
            setOpen(true)
            if (state === 'error' || !info) load()
          }}
          aria-label={`Abrir painel de cenários do mock${active !== 'default' ? ` (cenário ativo: ${active})` : ''}`}
          className="flex h-10 items-center gap-2 rounded-full border border-line-soft bg-surface-card px-2.5 text-highlight shadow-lg transition-colors hover:bg-surface-raised"
        >
          <FlaskConical className="size-5" aria-hidden />
          {active !== 'default' && <span className="max-w-32 truncate text-xs font-bold">{active}</span>}
        </button>
      )}
    </div>
  )
}
