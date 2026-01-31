import { mkdirSync } from 'node:fs'
import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'
const EMAIL = process.env.PLAYWRIGHT_EMAIL ?? ''
const PASSWORD = process.env.PLAYWRIGHT_PASSWORD ?? ''

test('phase2 auth flow proof', async ({ page }) => {
  mkdirSync('proof/phase2', { recursive: true })

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' })
  await expect(page.getByText('BuildCRM')).toBeVisible()
  await page.screenshot({ path: 'proof/phase2/login.png', fullPage: true })
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Пароль').fill(PASSWORD)
  await page.getByRole('button', { name: 'Войти' }).click()
  await page.waitForURL('**/leads')
  await expect(page.getByRole('heading', { name: 'Заявки' })).toBeVisible()
  await page.screenshot({ path: 'proof/phase2/leads.png', fullPage: true })

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForURL('**/leads')
  await expect(page.getByRole('heading', { name: 'Заявки' })).toBeVisible()
  await page.screenshot({ path: 'proof/phase2/leads-refresh.png', fullPage: true })

})
