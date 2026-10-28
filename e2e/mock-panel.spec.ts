import { expect, open, test } from './fixtures'

test.describe('painel de cenários do mock', () => {
  test('troca de cenário dá retorno visível e funciona mesmo com a API "offline"', async ({ page }) => {
    await open(page, '/')
    await expect(page.locator('main article').first()).toBeVisible()
    await page.getByRole('button', { name: /Abrir painel de cenários/ }).click()
    const panel = page.getByRole('region', { name: 'Cenários de simulação' })
    await panel.getByRole('radio', { name: /offline/ }).click()
    await expect(page.getByText('Cenário “offline” ativado')).toBeVisible()
    await expect(page.getByRole('button', { name: /Abrir painel de cenários.*offline/ }).or(panel)).toBeVisible()

    // the control endpoints never go through the failure gate: the panel still answers while "offline"
    await page.reload()
    await page.getByRole('button', { name: /Abrir painel de cenários.*offline/ }).click()
    await expect(panel.getByRole('radio', { name: /offline/ })).toBeChecked()
    await panel.getByRole('radio', { name: /default/ }).click()
    await expect(page.getByText('Cenário “default” ativado')).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: /resultados/ })).toHaveText('60 resultados')
  })

  test('resetar dados e sessão confirma o que fez', async ({ page }) => {
    await open(page, '/', 'slow')
    await page.getByRole('button', { name: /Abrir painel de cenários/ }).click()
    await page.getByRole('button', { name: 'Resetar dados e sessão' }).click()
    await expect(page.getByText('Dados e sessão restaurados. Cenário padrão ativo.')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Cenários de simulação' }).getByRole('radio', { name: /default/ })).toBeChecked()
  })

  test('mocks se recuperam quando o navegador encerra o service worker', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await open(page, '/')
    await expect(page.locator('main article').first()).toBeVisible()
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('ServiceWorker.enable')
    await cdp.send('ServiceWorker.stopAllWorkers')
    // a fresh request right after the worker dies: it must recover on its own, not end in an error screen
    await page.getByRole('tab', { name: 'Em alta' }).click()
    const results = page.getByRole('status').filter({ hasText: /resultados/ })
    await expect(results).not.toHaveText('60 resultados', { timeout: 20_000 })
    await expect(results).toHaveText(/^\d+ resultados$/, { timeout: 20_000 })
    await page.getByRole('button', { name: /Abrir painel de cenários/ }).click()
    await page.getByRole('region', { name: 'Cenários de simulação' }).getByRole('radio', { name: /slow/ }).click()
    await expect(page.getByText('Cenário “slow” ativado')).toBeVisible()
    await expect(page.getByText('Something went wrong')).toHaveCount(0)
    expect(errors).toEqual([])
  })
})
