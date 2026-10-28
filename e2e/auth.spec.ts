import { addToCart, ANA, BRUNO, expect, isMobile, login, mock, open, test } from './fixtures'

test.describe('conta e sessão', () => {
  test('cadastro valida campos e trata conflito de e-mail', async ({ page }) => {
    await open(page, '/register')
    await page.getByRole('button', { name: 'Criar conta', exact: true }).last().click()
    await expect(page.getByText('Informe um e-mail válido')).toBeVisible()

    await page.getByLabel('Nome de usuário').fill('nova.pessoa')
    await page.getByLabel('E-mail', { exact: true }).fill(ANA.email)
    await page.getByLabel('Senha', { exact: true }).fill('Segura123')
    await page.getByLabel('Confirmar senha').fill('Segura123')
    await page.getByRole('button', { name: 'Criar conta', exact: true }).last().click()
    await expect(page.getByText('Este e-mail já está cadastrado.').first()).toBeVisible()
    await expect(page.getByLabel('E-mail', { exact: true })).toHaveAttribute('aria-invalid', 'true')

    await page.getByLabel('E-mail', { exact: true }).fill('nova@kurio.test')
    await page.getByRole('button', { name: 'Criar conta', exact: true }).last().click()
    await expect(page).toHaveURL('/')
    await page.reload() // session survives refresh
    if (!isMobile(page)) await expect(page.getByRole('link', { name: /Perfil de nova\.pessoa/ })).toBeVisible()
  })

  test('login inválido mostra erro', async ({ page }) => {
    await open(page, '/login')
    await page.getByLabel('E-mail', { exact: true }).fill(ANA.email)
    await page.getByLabel('Senha', { exact: true }).fill('errada123')
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' })).toBeVisible()
  })

  test('expiração de sessão durante a navegação leva ao login e retorna ao fluxo', async ({ page }) => {
    await login(page, ANA, '/profile')
    await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible()
    await mock(page, 'expireSessions')
    await page.getByRole('navigation', { name: 'Minha conta' }).getByRole('link', { name: 'Carteiras' }).click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fprofile%2Fwallets/)
    await expect(page.getByText('Sua sessão expirou.').first()).toBeVisible()
    await page.getByLabel('E-mail', { exact: true }).fill(ANA.email)
    await page.getByLabel('Senha', { exact: true }).fill(ANA.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/profile\/wallets$/)
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()
  })

  test('sessão expira no checkout: login devolve ao pagamento com o formulário preservado', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')
    await login(page, ANA, '/checkout')
    await page.getByLabel('Observação do colecionador (opcional)').fill('entregar na carteira principal')
    await mock(page, 'expireSessions')
    await page.getByRole('button', { name: /^Conectar MetaMask/ }).click() // first authenticated call → 401
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
    await page.getByLabel('E-mail', { exact: true }).fill(ANA.email)
    await page.getByLabel('Senha', { exact: true }).fill(ANA.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/checkout$/)
    await expect(page.getByLabel('Observação do colecionador (opcional)')).toHaveValue('entregar na carteira principal')
  })

  test('logout e troca de usuário não vazam dados privados', async ({ page }) => {
    await addToCart(page, 'emerald-ape-042')
    await login(page, ANA, '/checkout')
    await page.getByLabel('Observação do colecionador (opcional)').fill('nota privada da Ana')
    await open(page, '/profile/favorites')
    await expect(page.locator('main article')).toHaveCount(1) // Ana has Emerald Ape favorited in the seed
    await page.getByRole('navigation', { name: 'Minha conta' }).getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL('/')
    // nothing typed or saved for Ana's purchase may stay in the tab for the next person
    const stored = await page.evaluate(() => JSON.stringify({ ...sessionStorage }))
    expect(stored).not.toContain(ANA.email)
    expect(stored).not.toContain('nota privada da Ana')
    await open(page, '/profile/favorites')
    await expect(page).toHaveURL(/\/login/) // private route after logout
    await page.getByLabel('E-mail', { exact: true }).fill(BRUNO.email)
    await page.getByLabel('Senha', { exact: true }).fill(BRUNO.password)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByText('Nenhum favorito ainda')).toBeVisible()
  })
})
