import { test, expect } from '@playwright/test'

test.describe('Nvara Operations Workspace Authentication & Session Flow', () => {
  test('Complete End-to-End Auth, Session Restoration, and Sign Out Flow', async ({ page }) => {
    // 1. Open Public Landing
    await page.goto('/')
    await expect(page.getByText('Service Operations Platform')).toBeVisible()

    // 2. Client Portal is public
    await page.getByRole('button', { name: /Client Request Portal/i }).click()
    await expect(page.getByText('Submit Project Requirements')).toBeVisible()
    await page.getByRole('button', { name: /Portal Home/i }).click()
    await expect(page.getByText('Service Operations Platform')).toBeVisible()

    // 3. Operations Workspace routes to Login
    await page.getByRole('button', { name: /Operations & PM Workspace/i }).click()
    await expect(page.getByText('Sign in to Operations')).toBeVisible()
    await expect(page.getByLabel(/Work Email/i)).toBeVisible()
    await expect(page.getByLabel(/^Password/i)).toBeVisible()

    // 4. Invalid credentials show error
    await page.getByLabel(/Work Email/i).fill('pm@nvaramedia.com')
    await page.getByLabel(/^Password/i).fill('WrongPassword123!')
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/v1/auth/login') && res.status() === 401),
      page.locator('button[type="submit"]').click(),
    ])
    await expect(page.getByRole('alert')).toContainText('Invalid email or password.')

    // 5. Valid login succeeds and loads Operations Workspace
    const pmPass = process.env.DEV_PM_PASSWORD || 'Nvara#PM2026!Secure'
    await page.getByLabel(/Work Email/i).fill('pm@nvaramedia.com')
    await page.locator('input#password').fill(pmPass)
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/v1/auth/login') && res.status() === 200),
      page.locator('button[type="submit"]').click(),
    ])
    await expect(page.getByRole('heading', { name: 'Operations Queue' })).toBeVisible({ timeout: 15000 })

    // 6. Browser refresh preserves authenticated session
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Operations Queue' })).toBeVisible({ timeout: 15000 })

    // 7. Sign out revokes session and returns to Landing
    const mobileMenu = page.getByRole('button', { name: /Open navigation/i })
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click()
    }
    await page.getByRole('button', { name: 'Sign out' }).first().click()
    await expect(page.getByText('Service Operations Platform')).toBeVisible()

    // 8. Re-entering Operations Workspace requires Login
    await page.getByRole('button', { name: /Operations & PM Workspace/i }).click()
    await expect(page.getByText('Sign in to Operations')).toBeVisible()
  })
})
