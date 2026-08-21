import { test, expect } from '@playwright/test'

test('Nvara landing page renders without browser errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (message) => {
    // Filter out expected 401 unauthenticated check on initial public landing mount
    if (message.type() === 'error' && !message.text().includes('401')) {
      errors.push(message.text())
    }
  })
  page.on('pageerror', (error) => errors.push(error.message))

  await page.goto('/')
  await expect(page).toHaveTitle(/Nvara|Ticket/i)
  await expect(page.locator('body')).toContainText(/Nvara|ticket|request/i)
  expect(errors).toEqual([])
})
