import { addToCart, expect, mock, open, test, waitForSocket } from './fixtures'
import { listOrders, openReview, readyToConfirm } from './checkout-helpers'

// Every event below is emitted by the simulated Socket.IO server and travels through socket.io-client.
test.describe('tempo real (Socket.IO)', () => {
  test('preço muda durante o checkout: aviso, resumo atualizado e nova confirmação', async ({ page }) => {
    await readyToConfirm(page)
    await waitForSocket(page)
    await openReview(page)
    const dialog = page.getByRole('dialog', { name: 'Revise seu pedido' })
    await expect(dialog.getByText('1.198 ETH')).toBeVisible() // 1.19 + 0.008

    await mock(page, 'changePrice', 'emerald-ape-042', 3, '0.05')
    await expect(page.getByText(/Preço atualizado: Emerald Ape #042/)).toBeVisible()
    await expect(dialog.getByText('Os valores mudaram desde que você abriu a revisão.', { exact: false })).toBeVisible()
    await expect(dialog.getByText('1.248 ETH')).toBeVisible()
    const confirm = dialog.getByRole('button', { name: 'Confirmar novos valores' })
    await expect(confirm).toBeVisible()
    await confirm.click()
    await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('dialog').getByText('1.248 ETH').first()).toBeVisible()
  })

  test('cotação desatualizada é recusada pelo servidor quando o evento não chega', async ({ page }) => {
    await readyToConfirm(page)
    await openReview(page)
    await mock(page, 'outage', 3000) // socket down: the client cannot learn about the change
    await mock(page, 'changePrice', 'emerald-ape-042', 3, '0.10')
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByRole('dialog').getByRole('alert').filter({ hasText: 'Preço, disponibilidade ou taxas mudaram' })).toBeVisible()
    await expect(page.getByRole('dialog').getByText('1.298 ETH')).toBeVisible()
    expect(await listOrders(page)).toHaveLength(0)
  })

  test('edição esgota no carrinho (cenário sold-out) e o checkout é bloqueado', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')
    await page.goto('/cart?scenario=sold-out')
    await expect(page.getByText(/Emerald Ape #042 \(1\/50\) esgotou\./).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'Conectar e finalizar' })).toBeDisabled()
  })

  test('eventos duplicados ou antigos não regridem o estado', async ({ page }) => {
    await open(page, '/nft/emerald-ape-042')
    await waitForSocket(page)
    const price = page.locator('main article p.text-xl').first()
    await mock(page, 'changePrice', 'emerald-ape-042', 3, '0.05') // v2 → 1.24
    await mock(page, 'changePrice', 'emerald-ape-042', 3, '0.05') // v3 → 1.29
    await expect(price).toHaveText('1.29 ETH')
    await mock(page, 'replayLastEvent') // duplicate v3
    await mock(page, 'replayStaleEvent', 'emerald-ape-042') // stale v2 (1.24)
    await page.waitForTimeout(500)
    await expect(price).toHaveText('1.29 ETH')
  })

  test('queda de conexão com pedido pendente: retoma o mesmo pedido após reconectar e recarregar', async ({ page }) => {
    await readyToConfirm(page)
    await openReview(page)
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByText(/Aguardando confirmação/)).toBeVisible()
    await mock(page, 'outage', 4000) // settlement event fires while the socket is down
    await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible({ timeout: 15_000 })
    await page.reload()
    await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible()
    expect(await listOrders(page)).toHaveLength(1)
  })
})
