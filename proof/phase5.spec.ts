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

const seedProfile = async (page: Page) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('buildcrm_profile_email')) {
      localStorage.setItem('buildcrm_profile_email', 'manager@buildcrm.kz')
    }
    if (!localStorage.getItem('buildcrm_notifications_enabled')) {
      localStorage.setItem('buildcrm_notifications_enabled', 'true')
    }
  })
}

const buildLocalDateTime = (hours: number, minutes: number) => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  return `${year}-${month}-${day}T${hh}:${mm}:00`
}

test('phase5 profile toggle persists', async ({ page }) => {
  mkdirSync('proof/phase5', { recursive: true })
  await setToken(page, TOKEN)
  await seedProfile(page)

  await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible()
  await page.screenshot({ path: 'proof/phase5/profile.png', fullPage: true })

  const toggle = page.getByLabel('Уведомления о заявках')
  await toggle.click()
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByLabel('Уведомления о заявках')).not.toBeChecked()
})

test('phase5 hot leads navigation', async ({ page }) => {
  mkdirSync('proof/phase5', { recursive: true })
  await setToken(page, TOKEN)
  await seedProfile(page)

  const hotDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
  const freshDate = buildLocalDateTime(14, 30)
  const leads = [
    {
      id: 'lead-hot',
      name: 'Айша Сапарова',
      city: 'Алматы',
      summary: 'Запрос на смету и материалы.',
      created_at: hotDate,
      status: 'new',
    },
    {
      id: 'lead-fresh',
      name: 'Тимур Б.',
      city: 'Астана',
      summary: 'Нужна консультация по фасаду.',
      created_at: freshDate,
      status: 'new',
    },
    {
      id: 'lead-success',
      name: 'Елена К.',
      city: 'Шымкент',
      summary: 'Проверка статуса по договору.',
      created_at: hotDate,
      status: 'success',
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
  await expect(page.getByText('Айша Сапарова')).toBeVisible()
  await page.screenshot({ path: 'proof/phase5/leads.png', fullPage: true })

  await page.goto(`${BASE_URL}/profile`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Горячие лиды' }).click()
  await page.waitForURL('**/hot')
  await expect(page.getByText('Айша Сапарова')).toBeVisible()
  await expect(page.getByText('Тимур Б.')).toHaveCount(0)
  await page.screenshot({ path: 'proof/phase5/hot-leads.png', fullPage: true })
})
