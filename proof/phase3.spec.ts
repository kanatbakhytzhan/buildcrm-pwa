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

test('phase3 tabs empty state', async ({ page }) => {
  mkdirSync('proof/phase3', { recursive: true })
  await setToken(page, TOKEN)
  await page.route('https://crm-api-5vso.onrender.com/api/leads', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  )
  await page.goto(`${BASE_URL}/leads`, { waitUntil: 'networkidle' })
  await expect(page.getByText('Пока нет заявок')).toBeVisible()
  await page.screenshot({ path: 'proof/phase3/empty-new.png', fullPage: true })
  await page.getByRole('button', { name: 'Успешные' }).click()
  await expect(page.getByText('Пока нет заявок')).toBeVisible()
  await page.screenshot({ path: 'proof/phase3/empty-success.png', fullPage: true })
  await page.getByRole('button', { name: 'Отказные' }).click()
  await expect(page.getByText('Пока нет заявок')).toBeVisible()
  await page.screenshot({ path: 'proof/phase3/empty-failed.png', fullPage: true })
})

test('phase3 list and navigation', async ({ page }) => {
  mkdirSync('proof/phase3', { recursive: true })
  await setToken(page, TOKEN)
  const leads = [
    {
      id: 'lead-1',
      name: 'Иван Петров',
      city: 'Алматы',
      summary: 'Нужен ремонт квартиры и консультация по материалам.',
      created_at: '2025-01-20T10:00:00Z',
      status: 'new',
    },
    {
      id: 'lead-2',
      name: 'Анна Ермак',
      city: 'Астана',
      summary: 'Запрос на смету по фасаду и благоустройству.',
      created_at: '2025-01-19T09:30:00Z',
      status: 'success',
    },
    {
      id: 'lead-3',
      name: 'Сергей Иванов',
      city: 'Караганда',
      summary: 'Интересует строительство дома под ключ.',
      created_at: '2025-01-18T12:15:00Z',
      status: 'failed',
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
  await expect(page.getByText('Иван Петров')).toBeVisible()
  await page.screenshot({ path: 'proof/phase3/list-new.png', fullPage: true })
  await page.getByRole('button', { name: 'Успешные' }).click()
  await expect(page.getByText('Анна Ермак')).toBeVisible()
  await page.screenshot({ path: 'proof/phase3/list-success.png', fullPage: true })
  await page.getByRole('button', { name: 'Отказные' }).click()
  await expect(page.getByText('Сергей Иванов')).toBeVisible()
  await page.screenshot({ path: 'proof/phase3/list-failed.png', fullPage: true })
  await page.getByRole('button', { name: 'Необработанные' }).click()
  await expect(page.getByText('Иван Петров')).toBeVisible()
  await page.getByText('Иван Петров').click()
  await page.waitForURL('**/leads/lead-1')
  await expect(page.getByText('Детали заявки')).toBeVisible()
  await page.screenshot({ path: 'proof/phase3/details.png', fullPage: true })
})
