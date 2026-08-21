import { test, expect } from '@playwright/test'

test('client can submit a request and receive a durable reference', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Client Request Portal/i }).click()
  await expect(page.getByText('Submit Project Requirements')).toBeVisible()

  await page.getByLabel(/Your Full Name/i).fill('E2E Client')
  await page.getByLabel(/Company \/ Brand/i).fill('E2E Company')
  await page.getByLabel(/Work Email/i).fill(`e2e-${Date.now()}@example.test`)
  await page.getByLabel(/Phone/i).fill('+91 98765 43210')
  await page.locator('select').selectOption('seo')
  await page.getByLabel(/Requirement Summary/i).fill('E2E request summary')
  await page.getByLabel(/Detailed Deliverables/i).fill('E2E request persisted through the production API.')
  await page.getByRole('button', { name: /Submit Request/i }).click()

  await expect(page.getByText('Request Submitted')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/NVARA-\d{4}-[A-F0-9]{8}/)).toBeVisible()
})
