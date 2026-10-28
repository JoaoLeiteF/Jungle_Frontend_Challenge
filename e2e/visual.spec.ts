import type { Page } from '@playwright/test'
import { ANA, addToCart, expect, login, open, test } from './fixtures'

// Baselines live in e2e/__screenshots__ (versioned). Data is the deterministic seed; toasts, the
// mock panel and hover-only affordances are masked so only the product UI is compared.
async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForLoadState('networkidle')
  // fullPage screenshots don't scroll, so lazy images below the fold must be loaded explicitly
  await page.evaluate(async () => {
    for (const img of document.images) img.loading = 'eager'
    await Promise.all([...document.images].map((i) => i.decode().catch(() => undefined)))
  })
}
const masks = (page: Page) => [page.locator('[data-sonner-toaster]'), page.getByRole('button', { name: /painel de cenários/ })]

test.describe('regressão visual', () => {
  test('início', async ({ page }) => {
    await open(page, '/')
    await expect(page.locator('main article').first()).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('inicio.png', { fullPage: true, mask: masks(page) })
  })

  test('detalhe', async ({ page }) => {
    await open(page, '/nft/emerald-ape-042')
    await expect(page.getByRole('list').filter({ has: page.locator('article') }).first()).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true, mask: masks(page) })
  })

  test('carrinho', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042', 2)
    await addToCart(page, 'violet-nomad-314')
    await expect(page.locator('aside dl dd[aria-live]')).toBeVisible()
    await settle(page)
    await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true, mask: masks(page) })
  })

  test('pagamento', async ({ page }) => {
    await login(page, ANA)
    await addToCart(page, 'emerald-ape-042')
    await page.goto('/checkout')
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Souza')
    await settle(page)
    await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true, mask: masks(page) })
  })
})
