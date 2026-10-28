import { ANA, expect, login, open, test } from './fixtures'

test.describe('favoritos', () => {
  test('favoritar persiste para o usuário autenticado', async ({ page }) => {
    await login(page, ANA)
    await open(page, '/nft/sage-nomad-009')
    await page.getByRole('button', { name: 'Favoritar', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Favoritado' })).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Favoritado' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('falha na mutation desfaz a atualização otimista', async ({ page }) => {
    await login(page, ANA)
    await open(page, '/nft/sage-nomad-009', 'favorites-fail')
    await page.getByRole('button', { name: 'Favoritar', exact: true }).click()
    await expect(page.getByText(/Não foi possível favoritar Sage Nomad #009/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Favoritar', exact: true })).toHaveAttribute('aria-pressed', 'false')
  })

  test('visitante é levado ao login ao favoritar', async ({ page }) => {
    await open(page, '/nft/sage-nomad-009')
    await page.getByRole('button', { name: 'Favoritar', exact: true }).click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fnft%2Fsage-nomad-009/)
  })
})
