import { expect, open, test } from './fixtures'

test.describe('detalhe do NFT', () => {
  test('acesso direto mostra dados, edição esgotada e limite de quantidade', async ({ page }) => {
    await open(page, '/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByRole('radio', { name: /Edição 1\/50, 1\.19 ETH/ })).toHaveAttribute('aria-checked', 'true')

    // 1/1 is sold out in the seed: the state is exposed to assistive tech, not just by color
    await expect(page.getByRole('radio', { name: /Edição 1\/1,.*esgotada/ })).toHaveAttribute('aria-disabled', 'true')

    // 1/10 allows at most 3 per order
    await page.getByRole('radio', { name: /Edição 1\/10/ }).click()
    const plus = page.getByRole('button', { name: 'Aumentar quantidade', exact: true })
    for (let i = 0; i < 5; i++) if (await plus.isEnabled()) await plus.click()
    await expect(page.getByRole('group', { name: 'quantidade' }).locator('output')).toHaveText('3')
    await expect(plus).toBeDisabled()
  })

  test('NFT inexistente e rota inexistente', async ({ page }) => {
    await open(page, '/nft/nao-existe-999')
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    await open(page, '/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })
})
