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

test('phase7 offline outbox sync', async ({ page }) => {
  mkdirSync('proof/phase7', { recursive: true })
  await setToken(page, TOKEN)
  const leads = [
    {
      id: 'lead-1',
      name: 'Айгерим Бекова',
      city: 'Алматы',
      summary: 'Нужна консультация по материалам.',
      created_at: '2025-02-12T08:00:00Z',
      status: 'new',
      phone: '+7 (777) 123-45-67',
    },
    {
      id: 'lead-2',
      name: 'Руслан Н.',
      city: 'Астана',
      summary: 'Запрос на смету.',
      created_at: '2025-02-12T09:00:00Z',
      status: 'new',
      phone: '+7 (777) 222-11-00',
    },
  ]
  let patchCount = 0
  let deleteCount = 0

  await page.route('https://crm-api-5vso.onrender.com/api/leads', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(leads),
    }),
  )

  await page.route(
    'https://crm-api-5vso.onrender.com/api/leads/lead-1',
    (route) => {
      if (route.request().method() === 'PATCH') {
        patchCount += 1
        route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
        return
      }
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    },
  )

  await page.route(
    'https://crm-api-5vso.onrender.com/api/leads/lead-2',
    (route) => {
      if (route.request().method() === 'DELETE') {
        deleteCount += 1
        route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
        return
      }
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    },
  )

  await page.goto(`${BASE_URL}/leads`, { waitUntil: 'networkidle' })
  await expect(page.getByText('Айгерим Бекова')).toBeVisible()
  await expect(page.getByText('Руслан Н.')).toBeVisible()

  await page.context().setOffline(true)

  await page.getByText('Айгерим Бекова').click()
  await page.getByRole('button', { name: 'Успешно', exact: true }).click()
  await page.waitForURL('**/leads')
  await page.getByRole('button', { name: 'Успешные' }).click()
  await expect(page.getByText('Айгерим Бекова')).toBeVisible()
  await expect(page.getByText('Ожидает синхронизации')).toBeVisible()
  await page.screenshot({ path: 'proof/phase7/pending-indicator.png', fullPage: true })

  await page.getByRole('button', { name: 'Новые' }).click()
  await page.getByText('Руслан Н.').click()
  await page.getByRole('button', { name: 'Меню' }).click()
  await page.getByRole('button', { name: 'Удалить лид' }).click()
  await page.getByRole('button', { name: 'Удалить' }).click()
  await page.waitForURL('**/leads')
  await expect(page.getByText('Руслан Н.')).toHaveCount(0)

  await expect(page.getByText('В очереди: 2')).toBeVisible()

  await page.getByRole('link', { name: 'Профиль' }).click()
  await page.waitForURL('**/profile')
  await expect(
    page.getByText('Есть несинхронизированные действия: 2'),
  ).toBeVisible()
  await page.screenshot({ path: 'proof/phase7/profile-outbox.png', fullPage: true })

  await page.context().setOffline(false)
  await expect(
    page.getByText('Есть несинхронизированные действия: 2'),
  ).toHaveCount(0)

  await page.goto(`${BASE_URL}/leads`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Успешные' }).click()
  await expect(page.getByText('Ожидает синхронизации')).toHaveCount(0)
  expect(patchCount).toBe(1)
  expect(deleteCount).toBe(1)
})
