import { expect, open, test } from './fixtures'

test.describe('acessibilidade e teclado', () => {
  test('skip link e navegação por teclado até um NFT', async ({ page }) => {
    await open(page, '/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('main')).toBeFocused()
    // reach the first card title link with the keyboard and open it
    const first = page.getByRole('link', { name: 'Emerald Ape #042', exact: true }).first()
    for (let i = 0; i < 60 && !(await first.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
    await expect(first).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/nft\/emerald-ape-042$/)
  })

  test('diálogo de login prende o foco, valida e fecha com Esc', async ({ page }) => {
    await open(page, '/login')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    const email = dialog.getByLabel('E-mail', { exact: true })
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    await expect(page.locator(`[id="${describedBy}"]`)).toHaveText('Informe um e-mail válido')
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL('/')
  })

  test('feedback acessível de mutation (toast em região live)', async ({ page }) => {
    await open(page, '/nft/emerald-ape-042')
    await page.getByRole('button', { name: 'COMPRAR' }).click()
    await expect(page.getByRole('region', { name: /Notifications|Notificações/ }).getByText('Emerald Ape #042 adicionado ao carrinho.')).toBeVisible()
  })
})
