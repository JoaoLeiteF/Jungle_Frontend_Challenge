import { expect, mock, open, test } from './fixtures'

test.describe('carregamento, falha e recuperação', () => {
  test('skeletons durante carregamento lento preservam o layout', async ({ page }) => {
    // Time only moves when the test says so: a busy machine can't burn the 1.5 s latency before we look.
    await page.clock.install()
    await page.clock.pauseAt(new Date(Date.now() + 1000))
    await page.goto('/?scenario=slow')
    const skeletons = page.getByRole('list', { name: 'Carregando NFTs' })
    await expect
      .poll(async () => (await skeletons.isVisible()) || (await page.clock.runFor(100), false), { timeout: 20_000 })
      .toBe(true)
    await expect(skeletons.getByRole('listitem')).toHaveCount(9)
    const box = await skeletons.boundingBox()
    await page.clock.resume()
    const grid = page.getByRole('region', { name: 'Catálogo' }).locator('ul').filter({ has: page.locator('article') }).first()
    await expect(grid.locator('article')).toHaveCount(9, { timeout: 15_000 })
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
