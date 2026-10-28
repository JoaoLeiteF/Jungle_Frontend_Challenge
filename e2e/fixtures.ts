import { expect, test as base, type Page } from '@playwright/test'

export const ANA = { email: 'ana@kurio.test', password: 'Kurio@123', name: 'Ana Souza' }
export const BRUNO = { email: 'bruno@kurio.test', password: 'Kurio@123', name: 'Bruno Lima' }

type MockControl = {
  setScenario(name: string): void
  reset(): Promise<void>
  changePrice(nftId: string, edition?: number, deltaEth?: string): string
  setAvailability(nftId: string, edition: number, available: number): void
  expireSessions(): void
  replayLastEvent(): void
  replayStaleEvent(resourceId: string): void
  outage(ms: number): void
  peerCount(): number
}

/** Runs a control action on the simulated backend (MSW + socket server), never on the UI. */
export async function mock<K extends keyof MockControl>(page: Page, action: K, ...args: Parameters<MockControl[K]>) {
  await page.waitForFunction(() => !!window.__kurioMock)
  return page.evaluate(([a, rest]) => (window.__kurioMock as unknown as Record<string, (...x: unknown[]) => unknown>)[a as string]!(...(rest as unknown[])), [action, args] as const)
}

/** Opens a path and waits until MSW and the app are up. Each test has its own context → fresh seed. */
export async function open(page: Page, path = '/', scenario?: string) {
  const url = scenario ? `${path}${path.includes('?') ? '&' : '?'}scenario=${scenario}` : path
  await page.goto(url)
  await page.waitForFunction(() => !!window.__kurioMock && !!document.querySelector('main#conteudo'))
}

export async function waitForSocket(page: Page) {
  await expect.poll(() => mock(page, 'peerCount')).toBeGreaterThan(0)
}

export async function login(page: Page, user = ANA, redirect?: string) {
  await open(page, `/login${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`)
  await page.getByLabel('E-mail', { exact: true }).fill(user.email)
  await page.getByLabel('Senha', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('link', { name: new RegExp(`Perfil de ${user.name}`) }).or(page.getByRole('link', { name: 'Perfil', exact: true }))).toBeVisible()
}

/** Adds the default (1/50) edition of an NFT through the real detail page. */
export async function addToCart(page: Page, nftId: string, quantity = 1) {
  await open(page, `/nft/${nftId}`)
  for (let i = 1; i < quantity; i++) await page.getByRole('button', { name: 'Aumentar quantidade', exact: true }).click()
  await page.getByRole('button', { name: 'COMPRAR' }).click()
  await expect(page).toHaveURL(/\/cart$/)
}

export const isMobile = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768

export const test = base
export { expect }

declare global {
  interface Window {
    __kurioMock?: unknown
  }
}
