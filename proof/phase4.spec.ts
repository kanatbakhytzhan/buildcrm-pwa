import { mkdirSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const BASE_URL = 'http://localhost:5173'
const TOKEN = process.env.PLAYWRIGHT_TOKEN || 'playwright-token'

const setToken = async (page: Page, token: string) => {
  await page.addInitScript((value) => {
    localStorage.setItem('buildcrm_token', value)
  }, token)
}

test('phase4 status update moves lead to tab', async ({ page }) => {
  mkdirSync('proof/phase4', { recursive: true })
  await setToken(page, TOKEN)
  let leads = [
    {
      id: 'lead-10',
      name: 'Алия Смирнова',
      city: 'Алматы',
      summary: 'Запрос на дизайн и смету.',
      created_at: '2025-02-01T08:00:00Z',
      status: 'new',
      phone: '+7 (777) 111-22-33',
    },
    {
      id: 'lead-11',
      name: 'Даурен А.',
      city: 'Алматы',
      summary: 'Нужна консультация по срокам.',
      created_at: '2025-02-01T09:00:00Z',
      status: 'new',
      phone: '+7 (777) 222-33-44',
    },
  ]

  await page.route('https://crm-api-5vso.onrender.com/api/leads', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(leads),
    }),
  )

  await page.route('https://crm-api-5vso.onrender.com/api/leads/*', (route) => {
    const request = route.request()
    const method = request.method()
    const id = request.url().split('/').pop() ?? ''
    if (method === 'PATCH') {
      const payload = request.postDataJSON() as { status?: string }
      const status = String(payload?.status ?? '')
      leads = leads.map((lead) =>
        lead.id === id ? { ...lead, status } : lead,
      )
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id, status }),
      })
      return
    }
    const lead = leads.find((item) => item.id === id)
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(lead ?? {}),
    })
  })

  await page.goto(`${BASE_URL}/leads`, { waitUntil: 'networkidle' })
  await expect(page.getByText('Алия Смирнова')).toBeVisible()
  await expect(page.getByText('Даурен А.')).toBeVisible()
  await page.screenshot({ path: 'proof/phase4/status-move-before.png', fullPage: true })
  await page.getByText('Алия Смирнова').click()
  await expect(page.getByRole('heading', { name: 'Заявка #lead-10' })).toBeVisible()
  await page.screenshot({ path: 'proof/phase4/details.png', fullPage: true })
  await page.getByRole('button', { name: 'Успешно', exact: true }).click()
  await page.waitForURL('**/leads')
  await expect(page.getByText('Алия Смирнова')).toHaveCount(0)
  await expect(page.getByText('Даурен А.')).toBeVisible()
  await page.screenshot({ path: 'proof/phase4/status-move-after-new.png', fullPage: true })
  await page.getByRole('button', { name: 'Успешные' }).click()
  await expect(page.getByText('Алия Смирнова')).toBeVisible()
  await page.screenshot({ path: 'proof/phase4/status-move-after-success.png', fullPage: true })
  await page.getByRole('button', { name: 'Новые' }).click()
  await page.getByText('Даурен А.').click()
  await expect(page.getByRole('heading', { name: 'Заявка #lead-11' })).toBeVisible()
  await page.getByRole('button', { name: 'Неуспешно', exact: true }).click()
  await page.waitForURL('**/leads')
  await expect(page.getByText('Даурен А.')).toHaveCount(0)
  await page.screenshot({ path: 'proof/phase4/status-move-after-new-failed.png', fullPage: true })
  await page.getByRole('button', { name: 'Отказные' }).click()
  await expect(page.getByText('Даурен А.')).toBeVisible()
  await page.screenshot({ path: 'proof/phase4/status-move-after-failed.png', fullPage: true })
})

test('phase4 time badge uses Almaty timezone', async ({ page }) => {
  mkdirSync('proof/phase4', { recursive: true })
  await setToken(page, TOKEN)
  const leads = [
    {
      id: 'lead-time',
      name: 'Айгерим Н.',
      city: 'Алматы',
      summary: 'Проверка времени заявки.',
      created_at: '2025-02-01T10:50:00Z',
      status: 'new',
      phone: '+7 (777) 333-44-55',
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
  await expect(page.getByText('Айгерим Н.')).toBeVisible()
  await expect(page.getByText('01.02, 15:50')).toBeVisible()
  await page.screenshot({ path: 'proof/phase4/time-badge.png', fullPage: true })
})

test('phase4 delete removes lead and shows toast', async ({ page }) => {
  mkdirSync('proof/phase4', { recursive: true })
  await setToken(page, TOKEN)
  let leads = [
    {
      id: 'lead-20',
      name: 'Нуржан К.',
      city: '',
      summary: 'Нужна консультация по ремонту.',
      created_at: '2025-02-02T11:20:00Z',
      status: 'new',
      phone: '',
    },
  ]

  await page.route('https://crm-api-5vso.onrender.com/api/leads', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(leads),
    }),
  )

  await page.route('https://crm-api-5vso.onrender.com/api/leads/lead-20', (route) => {
    if (route.request().method() === 'DELETE') {
      leads = []
      route.fulfill({ status: 204, contentType: 'application/json', body: '' })
      return
    }
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  await page.goto(`${BASE_URL}/leads`, { waitUntil: 'networkidle' })
  await page.getByText('Нуржан К.').click()
  await page.getByLabel('Меню').click()
  await page.screenshot({ path: 'proof/phase4/menu.png', fullPage: true })
  await page.getByRole('button', { name: 'Удалить лид' }).click()
  await expect(page.getByText('Удалить лид?')).toBeVisible()
  await page.getByRole('button', { name: 'Удалить' }).click()
  await page.waitForURL('**/leads')
  await expect(page.getByText('Лид удалён')).toBeVisible()
  await expect(page.getByText('Нуржан К.')).toHaveCount(0)
  await page.screenshot({ path: 'proof/phase4/delete-toast.png', fullPage: true })
})
