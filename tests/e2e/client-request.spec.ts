import { test, expect } from '@playwright/test'

test('client can submit a request and receive a durable reference', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Submit a Request/ }).click()
  await page.getByPlaceholder('e.g. Priya Shah').fill('E2E Client')
  await page.getByPlaceholder('e.g. Acme Brands').fill('E2E Company')
  await page.getByPlaceholder('you@company.com').fill(`e2e-${Date.now()}@example.test`)
  await page.getByPlaceholder('+91 98765 43210').fill('+91 98765 43210')
  await page.locator('select').selectOption('seo')
  await page.getByPlaceholder('Briefly describe what you need').fill('E2E request summary')
  await page.getByPlaceholder(/Share as much detail/).fill('E2E request persisted through the production API.')
  await page.getByRole('button', { name: /Submit request/i }).click()
  await expect(page.getByText('Request Submitted')).toBeVisible()
  await expect(page.getByText(/NVARA-\d{4}-[A-F0-9]{8}/)).toBeVisible()
})
