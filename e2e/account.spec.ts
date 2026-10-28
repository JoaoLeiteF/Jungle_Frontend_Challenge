import { ANA, BRUNO, expect, login, test } from './fixtures'

// 1×1 transparent PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')

test.describe('perfil e carteiras', () => {
  test('edição de perfil com validação, avatar e persistência', async ({ page }) => {
    await login(page, ANA, '/profile')
    const name = page.getByLabel('Nome de exibição')
    await expect(name).toHaveValue('Ana Souza')
    await name.fill('A')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Mínimo de 2 caracteres')).toBeVisible()
    await expect(name).toHaveAttribute('aria-invalid', 'true')

    // conflict returned by the API lands on the field
    await name.fill('Ana Paula')
    await page.getByLabel('Nome de usuário').fill('bruno.lima')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Este nome de usuário já está em uso.')).toBeVisible()

    await page.getByLabel('Nome de usuário').fill('ana.paula')
    await page.locator('input[type=file]').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByAltText('Avatar atual')).toBeVisible()
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText('Perfil atualizado.')).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Nome de exibição')).toHaveValue('Ana Paula')
    await expect(page.getByAltText('Avatar atual')).toBeVisible()
  })

  test('alteração de senha valida a senha atual', async ({ page }) => {
    await login(page, ANA, '/profile')
    await page.getByLabel('Senha atual').fill('errada000')
    await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha1')
    await page.getByLabel('Confirmar nova senha').fill('NovaSenha2')
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('As senhas não conferem')).toBeVisible()
    await page.getByLabel('Confirmar nova senha').fill('NovaSenha1')
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('Senha atual incorreta.').first()).toBeVisible()
    await page.getByLabel('Senha atual').fill(ANA.password)
    await page.getByRole('button', { name: 'Alterar senha' }).click()
    await expect(page.getByText('Senha alterada.')).toBeVisible()
  })

  test('cadastro de carteiras principal e secundária com erros de validação', async ({ page }) => {
    await login(page, BRUNO, '/profile/wallets') // Bruno starts without wallets
    const primary = page.getByRole('region', { name: 'Carteira principal' }).or(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Carteira principal' }) }))
    await primary.getByLabel('Endereço da carteira').fill('0x123')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(primary.getByText('Endereço inválido (0x + 40 hex)')).toBeVisible()
    await primary.getByLabel('Nome ENS (opcional)').fill('sem-sufixo')
    await primary.getByLabel('Endereço da carteira').fill('0x' + 'ab'.repeat(20))
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(primary.getByText('Use o formato nome.eth')).toBeVisible()
    await primary.getByLabel('Nome ENS (opcional)').fill('bruno.eth')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira Principal salva.')).toBeVisible()

    await page.getByRole('button', { name: 'Adicionar' }).click()
    const secondary = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Carteira secundária' }) })
    await secondary.getByRole('combobox', { name: 'Rede', exact: true }).selectOption('polygon')
    await expect(secondary.getByLabel('Nome ENS (opcional)')).toBeDisabled()
    await secondary.getByLabel('Endereço da carteira').fill('0x' + 'ab'.repeat(20)) // same as primary → API conflict
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(secondary.getByText('Este endereço já está cadastrado.')).toBeVisible()
    await secondary.getByLabel('Endereço da carteira').fill('0x' + 'cd'.repeat(20))
    await secondary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira Reserva salva.')).toBeVisible()
    await page.reload()
    await expect(page.locator('section').filter({ has: page.getByRole('heading', { name: 'Carteira secundária' }) }).getByLabel('Endereço da carteira')).toHaveValue('0x' + 'cd'.repeat(20))
  })
})
