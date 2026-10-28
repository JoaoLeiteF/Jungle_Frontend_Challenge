import { expect, mock, open, test } from './fixtures'

test.describe('carregamento, falha e recuperação', () => {
  test('skeletons durante carregamento lento preservam o layout', async ({ page }) => {
    await page.clock.install()
    await page.goto('/?scenario=slow')
    await page.waitForFunction(() => !!window.__kurioMock)
    const skeletons = page.getByRole('list', { name: 'Carregando NFTs' })
    await expect(skeletons).toBeVisible()
    await expect(skeletons.getByRole('listitem')).toHaveCount(9)
    const box = await skeletons.boundingBox()
    await page.clock.runFor(4000)
    const grid = page.locator('main ul').filter({ has: page.locator('article') }).first()
    await expect(grid.locator('article')).toHaveCount(9)
    const after = await grid.boundingBox()
    expect(Math.abs((after?.y ?? 0) - (box?.y ?? 0))).toBeLessThan(2) // no layout shift of the grid
  })

  test('falha HTTP 500 mostra feedback e recupera com nova tentativa', async ({ page }) => {
    await open(page, '/', 'error-500')
    await expect(page.getByRole('alert').filter({ hasText: 'Falha temporária no catálogo.' })).toBeVisible({ timeout: 15_000 })
    await mock(page, 'setScenario', 'default')
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('status').filter({ hasText: /resultados/ })).toHaveText('60 resultados')
  })

  test('sem conexão: erro de rede e recuperação', async ({ page }) => {
    await open(page, '/nft/emerald-ape-042', 'offline')
    await expect(page.getByRole('alert').filter({ hasText: 'Sem conexão com o servidor.' })).toBeVisible({ timeout: 15_000 })
    await mock(page, 'setScenario', 'default')
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
  })
})
