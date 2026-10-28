import type { Page } from '@playwright/test'
import { ANA, addToCart, expect, login } from './fixtures'

/** Logged-in buyer with one NFT in the cart, sitting on the checkout page with the wallet connected. */
export async function readyToConfirm(page: Page, nftId = 'emerald-ape-042', scenario?: string) {
  await login(page, ANA)
  await addToCart(page, nftId)
  await page.goto(`/checkout${scenario ? `?scenario=${scenario}` : ''}`)
  await page.getByRole('button', { name: /^Conectar MetaMask/ }).click()
  await expect(page.getByText(/conectada via MetaMask/)).toBeVisible()
}

export async function openReview(page: Page) {
  await page.getByRole('button', { name: 'Revisar e confirmar compra' }).click()
  await expect(page.getByRole('dialog', { name: 'Revise seu pedido' })).toBeVisible()
}

/** Orders as the API sees them (authenticated with the page's own session token). */
export function listOrders(page: Page) {
  return page.evaluate(async () => {
    const r = await fetch('/api/orders', { headers: { Authorization: `Bearer ${localStorage.getItem('kurio.session')}` } })
    return ((await r.json()) as { items: { id: string; status: string }[] }).items
  })
}
