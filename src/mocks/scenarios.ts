// Network conditions and business scenarios for the simulated backend. Selected by `?scenario=`,
// by the in-app Mock panel, or by window.__kurioMock (Playwright). Persisted so a refresh keeps it.
import { delay, HttpResponse } from 'msw'

export const SCENARIOS = {
  default: 'Padrão — latência curta, pagamento confirmado',
  empty: 'Catálogo vazio',
  slow: 'Lento — 1,5 a 3 s por requisição',
  jitter: 'Latência variável — respostas fora de ordem',
  offline: 'Sem conexão (falha de rede em toda a API)',
  'error-500': 'Catálogo e detalhe respondem HTTP 500',
  'flaky-503': 'Primeira tentativa de cada GET responde 503',
  'favorites-fail': 'Favoritar/desfavoritar responde 500 (rollback)',
  'session-expired': 'Sessões expiram após 20 s',
  'price-change': 'Preço do 1º item do carrinho sobe 4 s após abrir a cotação',
  'sold-out': 'Edição do 1º item esgota 4 s após abrir a cotação',
  'order-timeout': 'Pedido é criado, mas a resposta estoura o timeout',
  'payment-declined': 'Pagamento recusado pela simulação',
  'wallet-rejected': 'Carteira recusa a conexão',
} as const
export type ScenarioName = keyof typeof SCENARIOS

const KEY = 'kurio.mock.scenario'
let current: ScenarioName = 'default'
const attempts = new Map<string, number>()

export function initScenario() {
  const fromUrl = new URLSearchParams(location.search).get('scenario')
  const stored = (() => {
    try {
      return localStorage.getItem(KEY)
    } catch {
      return null
    }
  })()
  setScenario((fromUrl ?? stored ?? 'default') as ScenarioName)
}

export function setScenario(name: ScenarioName) {
  current = name in SCENARIOS ? name : 'default'
  attempts.clear()
  try {
    localStorage.setItem(KEY, current)
  } catch {
    /* ignore */
  }
}
export const scenario = () => current
export const is = (...names: ScenarioName[]) => names.includes(current)

// Seeded jitter so "out of order" runs are reproducible across executions.
let jitterSeed = 7
function jitterMs() {
  jitterSeed = (jitterSeed * 16807) % 2147483647
  return 100 + (jitterSeed % 2400)
}

/** Latency applied to every handler. Uses setTimeout, so Playwright's page.clock controls it. */
export async function latency() {
  if (is('slow')) return delay(1500 + jitterMs() / 2)
  if (is('jitter')) return delay(jitterMs())
  return delay(250)
}

/** Shared failure gate: returns a response to short-circuit the handler, or undefined to continue. */
export function failure(method: string, path: string): Response | undefined {
  if (is('offline')) return HttpResponse.error()
  if (is('error-500') && method === 'GET' && path.startsWith('/nfts'))
    return HttpResponse.json({ error: { code: 'INTERNAL', message: 'Falha temporária no catálogo.' } }, { status: 500 })
  if (is('flaky-503') && method === 'GET') {
    const n = (attempts.get(path) ?? 0) + 1
    attempts.set(path, n)
    if (n === 1)
      return HttpResponse.json({ error: { code: 'UNAVAILABLE', message: 'Serviço indisponível, tente novamente.' } }, { status: 503, headers: { 'Retry-After': '1' } })
  }
  if (is('favorites-fail') && path.startsWith('/favorites') && method !== 'GET')
    return HttpResponse.json({ error: { code: 'INTERNAL', message: 'Não foi possível atualizar seus favoritos.' } }, { status: 500 })
  return undefined
}

export const sessionTtlMs = () => (is('session-expired') ? 20_000 : 30 * 60_000)
