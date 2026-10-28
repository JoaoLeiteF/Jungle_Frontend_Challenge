import { expect, isMobile, open, test } from './fixtures'

test.describe('catálogo', () => {
  test('busca, filtros combinados, ordenação, paginação e histórico', async ({ page }) => {
    await open(page, '/')
    const results = page.getByRole('status').filter({ hasText: /resultados?/ })
    await expect(results).toHaveText('60 resultados')

    // pagination
    await page.getByRole('button', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(page.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')

    // filters reset pagination and combine (collection + network)
    if (isMobile(page)) await page.getByRole('button', { name: 'Abrir filtros' }).click()
    await page.getByRole('button', { name: /Arte digital/ }).click()
    await expect(page).not.toHaveURL(/page=/)
    await expect(page).toHaveURL(/collections=arte-digital/)
    const oneFilter = await results.textContent()
    await page.getByRole('button', { name: /Ethereum/ }).click()
    await expect(page).toHaveURL(/networks=ethereum/)
    await expect(results).not.toHaveText(oneFilter!)
    if (isMobile(page)) await page.keyboard.press('Escape')

    // sort
    await page.getByRole('combobox', { name: 'Ordenar por:' }).click()
    await page.getByRole('option', { name: 'Menor preço' }).click()
    await expect(page).toHaveURL(/sort=price-asc/)
    const prices = await page.locator('main article p.font-bold').allTextContents()
    const values = prices.map((p) => Number(p.split(' ')[0]))
    expect(values).toEqual([...values].sort((a, b) => a - b))

    // search composes with the rest of the URL state
    const search = isMobile(page) ? page.getByRole('searchbox', { name: 'Explorar coleções' }).or(page.getByLabel('Explorar coleções')) : null
    if (search) {
      await search.fill('golden')
      await search.press('Enter')
    } else {
      await page.getByRole('button', { name: 'Abrir busca' }).click()
      await page.getByLabel('Buscar NFTs').fill('golden')
      await page.getByLabel('Buscar NFTs').press('Enter')
    }
    await expect(page).toHaveURL(/q=golden/)
    await expect(page.locator('main article h3').first()).toContainText(/Golden/i)

    // history restores every previous state, and refresh keeps the current one
    await page.goBack()
    await expect(page).not.toHaveURL(/q=golden/)
    await expect(page).toHaveURL(/sort=price-asc/)
    await page.reload()
    await expect(page).toHaveURL(/collections=arte-digital/)
    await expect(page.getByRole('combobox', { name: 'Ordenar por:' })).toHaveText('Menor preço')
  })

  test('resultado vazio oferece limpar filtros', async ({ page }) => {
    await open(page, '/?q=nada-existe-aqui')
    await expect(page.getByText('Nenhum NFT encontrado')).toBeVisible()
    await page.getByRole('button', { name: 'Limpar busca e filtros' }).click()
    await expect(page.getByRole('status').filter({ hasText: /resultados/ })).toHaveText('60 resultados')
  })

  test('catálogo vazio (cenário empty)', async ({ page }) => {
    await open(page, '/', 'empty')
    await expect(page.getByText('O catálogo está vazio no momento.')).toBeVisible()
  })

  test('respostas fora de ordem não sobrescrevem a consulta mais recente (jitter)', async ({ page }) => {
    await open(page, '/', 'jitter')
    const results = page.getByRole('status').filter({ hasText: /resultados?/ })
    await expect(results).toHaveText('60 resultados', { timeout: 15_000 })
    // three queries in flight with random latencies (seeded): only the last one may win
    await page.getByRole('tab', { name: 'Novos lançamentos' }).click()
    await page.getByRole('tab', { name: 'Em alta' }).click()
    await page.getByRole('tab', { name: 'Todos os NFTs' }).click()
    await expect(page).not.toHaveURL(/tab=/)
    await expect(results).toHaveText('60 resultados', { timeout: 15_000 })
    await page.waitForTimeout(3000) // let any stale response arrive
    await expect(results).toHaveText('60 resultados')
  })
})
