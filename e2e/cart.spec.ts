import type { Page } from '@playwright/test'
import { ANA, addToCart, expect, test } from './fixtures'

const line = (page: Page, name: string) => page.getByRole('list', { name: 'Itens do carrinho' }).getByRole('listitem').filter({ hasText: name })
const total = (page: Page) => page.locator('aside dl dd[aria-live]')

test.describe('carrinho', () => {
  test('quantidades, remoção, cupom, refresh e mesclagem no login', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')
    await addToCart(page, 'golden-beat-207', 2)

    // 1.19 × 2 + 0.99 × 2 = 4.36; fee 0.004 + 2 × 0.004 = 0.012
    await line(page, 'Emerald Ape').getByRole('button', { name: /Aumentar/ }).click()
    await expect(line(page, 'Emerald Ape').locator('output')).toHaveText('2')
    await expect(total(page)).toHaveText('4.372 ETH')

    await line(page, 'Golden Beat').getByRole('button', { name: /Remover Golden Beat/ }).first().click()
    await expect(line(page, 'Golden Beat')).toHaveCount(0)
    await expect(total(page)).toHaveText('2.388 ETH')

    // coupons: invalid, expired, valid
    const coupon = page.getByLabel('Código promocional')
    await coupon.fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Cupom inválido.' })).toBeVisible()
    await coupon.fill('EXPIRED5')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Este cupom expirou.' })).toBeVisible()
    await coupon.fill('kurio10')
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await expect(page.getByText('Desconto (KURIO10 −10%)')).toBeVisible()
    await expect(total(page)).toHaveText('2.15 ETH') // 2.38 − 0.238 + 0.008

    // refresh keeps everything (cart lives behind the API)
    await page.reload()
    await expect(line(page, 'Emerald Ape').locator('output')).toHaveText('2')
    await expect(total(page)).toHaveText('2.15 ETH')

    // logging in merges the visitor cart into the account
    await page.goto('/login?redirect=%2Fcart')
    await page.getByLabel('E-mail', { exact: true }).fill(ANA.email)
    await page.getByLabel('Senha', { exact: true }).fill(ANA.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/cart$/)
    await expect(line(page, 'Emerald Ape').locator('output')).toHaveText('2')
  })

  test('carrinho vazio', async ({ page }) => {
    await page.goto('/cart')
    await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
  })
})
