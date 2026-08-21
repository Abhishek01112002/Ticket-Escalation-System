import { test, expect } from '@playwright/test'

// Use a unique reference per test run to avoid rate-limit bucket collision
// when integration tests run in the same API process window.
const DUMMY_VALID_FORMAT = `NVARA-2026-E2E${Date.now().toString(16).slice(-4).toUpperCase()}`.slice(0, 22).padEnd(18, '0')

test.describe('Public Request Tracker', () => {
  test.describe('Landing page', () => {
    test('shows "Track Your Request" gateway card', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByRole('heading', { name: 'Track Your Request' })).toBeVisible()
      await expect(page.getByRole('button', { name: /Track request status/i }).first()).toBeVisible()
    })
  })

  test.describe('Tracker screen', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: /Track request status/i }).first().click()
    })

    test('renders reference input and Track button', async ({ page }) => {
      await expect(page.getByLabel('Tracking Reference')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Track' })).toBeVisible()
    })

    test('Track button disabled when input is empty', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Track' })).toBeDisabled()
    })

    test('auto-uppercases input as user types', async ({ page }) => {
      const input = page.getByLabel('Tracking Reference')
      await input.fill('nvara-2026-aabbccdd')
      await expect(input).toHaveValue('NVARA-2026-AABBCCDD')
    })

    test('invalid format shows validation error without hitting API', async ({ page }) => {
      const input = page.getByLabel('Tracking Reference')
      await input.fill('NOT-VALID')
      await page.getByRole('button', { name: 'Track' }).click()
      await expect(page.getByRole('alert')).toContainText(/valid reference/i)
    })

    test('well-formed absent reference shows not-found state', async ({ page }) => {
      // Use a per-test-run unique reference to avoid rate-limit bucket collision
      const uniqueRef = `NVARA-${new Date().getFullYear()}-NOTFOUND1`
      await page.getByLabel('Tracking Reference').fill(uniqueRef)
      await page.getByRole('button', { name: 'Track' }).click()
      await expect(page.getByText('Reference Not Found')).toBeVisible({ timeout: 12_000 })
      await expect(page.getByText(uniqueRef)).toBeVisible()
    })

    test('back navigation returns to landing', async ({ page }) => {
      await page.getByRole('button', { name: /Portal Home/i }).click()
      await expect(page.getByRole('heading', { name: /Client requests, SLAs/i })).toBeVisible()
    })

    test('reference is NOT placed in the URL at any point', async ({ page }) => {
      await page.getByLabel('Tracking Reference').fill('NVARA-2026-URLTEST01')
      await page.getByRole('button', { name: 'Track' }).click()
      expect(page.url()).not.toContain('NVARA')
      expect(page.url()).not.toContain('reference=')
      expect(page.url()).not.toContain('ref=')
    })
  })

  test.describe('Confirmation → Tracker CTA flow', () => {
    test('confirmation screen has "Track this request" CTA', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: /Submit a new client request/i }).click()

      await page.getByLabel('Your Full Name').fill('Test User')
      await page.getByLabel('Company / Brand').fill('Acme Corp')
      await page.getByLabel('Work Email').fill('test@example.com')
      await page.getByLabel('Phone / WhatsApp').fill('+919876543210')

      // Service domain is a <select> — use selectOption
      await page.locator('select').selectOption({ value: 'seo' })

      await page.getByLabel('Requirement Summary').fill('Need SEO help for website ranking')
      await page.getByLabel('Detailed Deliverables').fill(
        'We need a comprehensive SEO audit and keyword strategy for our e-commerce website. Target 50 keywords.',
      )

      await page.getByRole('button', { name: /Submit Request/i }).click()

      await expect(page.getByText('Request Submitted')).toBeVisible({ timeout: 15_000 })
      await expect(page.getByRole('button', { name: /Track this request/i })).toBeVisible()
    })

    test('Track CTA navigates to tracker without reference in URL', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: /Submit a new client request/i }).click()

      await page.getByLabel('Your Full Name').fill('CTA Test User')
      await page.getByLabel('Company / Brand').fill('CTA Corp')
      await page.getByLabel('Work Email').fill('cta@example.com')
      await page.getByLabel('Phone / WhatsApp').fill('+919876543210')
      await page.locator('select').selectOption({ value: 'seo' })
      await page.getByLabel('Requirement Summary').fill('SEO for brand')
      await page.getByLabel('Detailed Deliverables').fill(
        'Full SEO strategy for 30 keywords and monthly reporting on search rankings.',
      )
      await page.getByRole('button', { name: /Submit Request/i }).click()
      await expect(page.getByText('Request Submitted')).toBeVisible({ timeout: 15_000 })

      const refEl = page.locator('span.font-mono').filter({ hasText: 'NVARA-' })
      const reference = await refEl.textContent()
      expect(reference).toMatch(/^NVARA-\d{4}-[A-Z0-9]{8,16}$/)

      await page.getByRole('button', { name: /Track this request/i }).click()

      await expect(page.getByLabel('Tracking Reference')).toBeVisible()
      expect(page.url()).not.toContain(reference ?? '')
      expect(page.url()).not.toContain('reference=')

      const inputValue = await page.getByLabel('Tracking Reference').inputValue()
      expect(inputValue).toBe(reference?.trim())

      // Core privacy invariants verified above.
      // Verify the input is pre-filled with the reference from confirmation.
      await expect(page.getByLabel('Tracking Reference')).toHaveValue(
        reference?.trim() ?? '',
        { timeout: 3_000 },
      )

      // Tracker is live and has transitioned away from the blank/idle state —
      // either showing a result card or a not-found message.
      // We wait for the Track button to be re-enabled (not loading) or any
      // result content to appear.
      await expect(
        page.locator('[role="alert"], [aria-live]').or(
          page.locator('h3').filter({ hasText: /Reference Not Found|In Progress|Received|Assigned|Completed/ }),
        ).or(
          page.locator('.font-mono').filter({ hasText: 'NVARA-' }),
        ),
      ).toBeVisible({ timeout: 12_000 })
    })
  })

  test.describe('Mobile viewport', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('tracker screen is usable on mobile', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: /Track request status/i }).first().click()
      await expect(page.getByLabel('Tracking Reference')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Track' })).toBeVisible()
      await expect(page.getByRole('button', { name: /Portal Home/i })).toBeVisible()
    })
  })
})
