import { ANA, expect, login, open, test } from './fixtures'
import { listOrders } from './checkout-helpers'

test('compra completa: do catálogo ao recibo confirmado', async ({ page }) => {
  await login(page, ANA)
  await open(page, '/')
  await page.getByRole('link', { name: 'Golden Beat #207', exact: true }).first().click()
  await expect(page).toHaveURL(/\/nft\/golden-beat-207$/)
  await page.getByRole('button', { name: 'COMPRAR' }).click()

  await expect(page).toHaveURL(/\/cart$/)
  await page.getByRole('link', { name: 'Conectar e finalizar' }).click()
  await expect(page).toHaveURL(/\/checkout$/)
  await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Souza')

  await page.getByRole('button', { name: /^Conectar MetaMask/ }).click()
  await page.getByRole('button', { name: 'Revisar e confirmar compra' }).click()
  const review = page.getByRole('dialog', { name: 'Revise seu pedido' })
  await expect(review.getByText('Golden Beat #207')).toBeVisible()
  await review.getByRole('button', { name: 'Confirmar compra' }).click()

  // pending first, then confirmed by the simulated settlement (order.updated over Socket.IO)
  await expect(page).toHaveURL(/\/orders\/ord_/)
  const receipt = page.getByRole('dialog')
  await expect(receipt.getByText(/Aguardando confirmação/)).toBeVisible()
  await expect(receipt.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible({ timeout: 10_000 })
  await expect(receipt.getByText('Golden Beat #207')).toBeVisible()
  await expect(receipt.getByText('0.998 ETH').first()).toBeVisible() // 0.99 + network fee 0.008 (snapshot from the API)
  expect((await listOrders(page)).filter((o) => o.status === 'confirmed')).toHaveLength(1)

  // only what was bought leaves the cart
  await page.keyboard.press('Escape')
  await page.goto('/cart')
  await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
})
