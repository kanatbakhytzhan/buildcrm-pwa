import { mkdirSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'
const TOKEN = process.env.PLAYWRIGHT_TOKEN ?? ''

const setToken = async (page: Page, token: string) => {
  await page.addInitScript((value) => {
    localStorage.setItem('buildcrm_token', value)
  }, token)
}

test('phase6 offline cache fallback', async ({ page }) => {
  mkdirSync('proof/phase6', { recursive: true })
  await setToken(page, TOKEN)
  const leads = [
    {
      id: 'lead-offline',
      name: 'Жанна Айтбаева',
      city: 'Алматы',
      summary: 'Нужна консультация по ремонту.',
      created_at: '2025-02-10T08:00:00Z',
      status: 'new',
    },
  ]

  await page.route('https://crm-api-5vso.onrender.com/api/leads', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(leads),
    }),
  )

  await page.goto(`${BASE_URL}/leads`, { waitUntil: 'networkidle' })
  await expect(page.getByText('Жанна Айтбаева')).toBeVisible()
  await page.screenshot({ path: 'proof/phase6/online.png', fullPage: true })

  await page.context().setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(
    page.getByText('Офлайн режим: показаны сохранённые данные'),
  ).toBeVisible()
  await expect(page.getByText('Жанна Айтбаева')).toBeVisible()
  await page.screenshot({ path: 'proof/phase6/offline.png', fullPage: true })
})

test('phase6 offline empty cache state', async ({ page }) => {
  mkdirSync('proof/phase6', { recursive: true })
  await setToken(page, TOKEN)
  await page.context().setOffline(true)

  await page.goto(`${BASE_URL}/leads`, { waitUntil: 'domcontentloaded' })
  await expect(
    page.getByText('Нет сохранённых данных. Подключитесь к интернету.'),
  ).toBeVisible()
  await page.screenshot({ path: 'proof/phase6/offline-empty.png', fullPage: true })
})
