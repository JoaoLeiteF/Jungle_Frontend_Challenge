import { expect, test } from './fixtures'
import { listOrders, openReview, readyToConfirm } from './checkout-helpers'

test.describe('pagamento: falhas e idempotência', () => {
  test('pagamento recusado preserva os itens no carrinho', async ({ page }) => {
    await readyToConfirm(page, 'emerald-ape-042', 'payment-declined')
    await openReview(page)
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible({ timeout: 10_000 })
    await page.getByRole('link', { name: 'Voltar ao carrinho' }).click()
    await expect(page.getByRole('list', { name: 'Itens do carrinho' }).getByText('Emerald Ape #042')).toBeVisible()
  })

  test('clique repetido não cria pedidos duplicados', async ({ page }) => {
    await readyToConfirm(page)
    await openReview(page)
    const confirm = page.getByRole('dialog').getByRole('button', { name: 'Confirmar compra' })
    await confirm.dblclick({ force: true })
    await expect(page).toHaveURL(/\/orders\/ord_/)
    await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible({ timeout: 10_000 })
    expect(await listOrders(page)).toHaveLength(1)
  })

  test('timeout após criar o pedido recupera o mesmo pedido pela chave de idempotência', async ({ page }) => {
    test.setTimeout(60_000)
    await readyToConfirm(page, 'emerald-ape-042', 'order-timeout')
    await openReview(page)
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByRole('dialog').getByRole('button', { name: /Processando/ })).toBeVisible()
    // server answers after 12 s, client gives up at 10 s and replays the same Idempotency-Key
    await expect(page).toHaveURL(/\/orders\/ord_/, { timeout: 30_000 })
    await expect(page.getByText('Seus NFTs agora estão na sua carteira')).toBeVisible({ timeout: 10_000 })
    expect(await listOrders(page)).toHaveLength(1)
  })

  test('carteira recusando a conexão e conector incompatível', async ({ page }) => {
    await readyToConfirm(page)
    await page.getByRole('button', { name: 'Desconectar' }).click()
    await page.getByRole('radio', { name: 'Coinbase Wallet' }).check()
    await page.getByRole('button', { name: /^Conectar Coinbase Wallet/ }).click()
    await expect(page.getByRole('alert').filter({ hasText: /conecte por MetaMask/ })).toBeVisible()
    await page.goto('/checkout?scenario=wallet-rejected')
    await page.getByRole('button', { name: /^Conectar MetaMask/ }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'A conexão foi recusada na carteira.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Revisar e confirmar compra' })).toHaveCount(0)
  })

  test('rede incompatível com a carteira bloqueia a revisão', async ({ page }) => {
    await readyToConfirm(page)
    await page.getByRole('combobox', { name: 'Rede', exact: true }).selectOption('polygon')
    await expect(page.getByText('Principal opera na rede Ethereum.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Revisar e confirmar compra' })).toBeDisabled()
  })
})
