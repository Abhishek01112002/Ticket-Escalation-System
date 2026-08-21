import { test, expect, type Page } from '@playwright/test'

async function loginAsPm(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /operations workspace/i }).click()
  await page.getByLabel('Work Email').fill('pm@nvaramedia.com')
  await page.locator('input#password').fill('Nvara#PM2026!Secure')
  const [response] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/v1/auth/login') && res.status() === 200),
    page.getByRole('button', { name: 'Sign in' }).click(),
  ])
  await page.waitForTimeout(400)
}

async function navigateToTeam(page: Page) {
  const menuBtn = page.getByRole('button', { name: 'Open navigation' })
  if (await menuBtn.isVisible()) {
    await menuBtn.click()
    await page.waitForTimeout(300)
    await page.locator('aside').getByRole('button', { name: 'Team Members' }).last().click()
  } else {
    await page.getByRole('button', { name: 'Team Members' }).click()
  }
}

async function openProfileModal(page: Page) {
  const menuBtn = page.getByRole('button', { name: 'Open navigation' })
  if (await menuBtn.isVisible()) {
    await menuBtn.click()
    await page.waitForTimeout(300)
    await page.locator('aside').getByTitle(/Account settings & change password/i).last().click()
  } else {
    await page.getByTitle(/Account settings & change password/i).click()
  }
}

test.describe('Tier-1 Team Management, Detail Drawer, Matrix & Identity Security', () => {
  test.describe('Team Management Directory & Capabilities', () => {
    test('PM can view team members, SLA compliance rates, and search the directory', async ({ page }) => {
      await loginAsPm(page)
      await navigateToTeam(page)

      await expect(page.getByRole('heading', { name: 'Team Management' })).toBeVisible({ timeout: 10_000 })
      await expect(page.getByText('Active Members')).toBeVisible()
      await expect(page.locator('tbody').getByText('Rohan Mehta', { exact: true })).toBeVisible({ timeout: 10_000 })
      await expect(page.locator('tbody').getByText('Priya Sharma', { exact: true })).toBeVisible({ timeout: 10_000 })

      const searchInput = page.getByPlaceholder(/Search by name or email/i)
      await searchInput.fill('Rohan')
      await expect(page.locator('tbody').getByText('Rohan Mehta', { exact: true })).toBeVisible()
      await expect(page.locator('tbody').getByText('Priya Sharma', { exact: true })).not.toBeVisible()

      await searchInput.fill('')
      await expect(page.locator('tbody').getByText('Priya Sharma', { exact: true })).toBeVisible()
    })

    test('Clicking a member opens the Slide-over Detail Drawer with SLA metrics and recent tickets', async ({ page }) => {
      await loginAsPm(page)
      await navigateToTeam(page)

      // Click on Rohan Mehta row
      await page.locator('tbody tr').filter({ hasText: 'Rohan Mehta' }).click()

      // Drawer should open
      const drawer = page.getByRole('dialog')
      await expect(drawer.getByText('Rohan Mehta')).toBeVisible({ timeout: 10_000 })
      await expect(drawer.getByText('Workload & SLA Metrics')).toBeVisible()
      await expect(drawer.getByText('SLA Compliance')).toBeVisible()
      await expect(drawer.getByText('Recent Handled Requests')).toBeVisible()

      // Close drawer
      await page.getByLabel('Close detail drawer').click()
      await expect(drawer).not.toBeVisible()
    })

    test('PM can open and inspect the Role & Permissions Matrix modal', async ({ page }) => {
      await loginAsPm(page)
      await navigateToTeam(page)

      await page.getByRole('button', { name: /Permissions Matrix/i }).click()
      await expect(page.getByRole('heading', { name: 'Role & Permissions Matrix' })).toBeVisible()
      await expect(page.getByText('Operations Queue & Triage')).toBeVisible()
      await expect(page.getByText('Team & Identity Administration')).toBeVisible()

      await page.getByRole('button', { name: 'Close Matrix' }).click()
      await expect(page.getByRole('heading', { name: 'Role & Permissions Matrix' })).not.toBeVisible()
    })

    test('PM can switch to the Audit Trail tab to view compliance logs', async ({ page }) => {
      await loginAsPm(page)
      await navigateToTeam(page)

      await page.getByRole('button', { name: 'Audit Trail' }).click()
      await expect(page.getByRole('heading', { name: 'Compliance Audit Trail' })).toBeVisible()

      await page.getByRole('button', { name: 'Directory' }).click()
      await expect(page.locator('table')).toBeVisible()
    })

    test('PM can add a new member in Dual-Mode (Invite Link mode vs Temp Password mode)', async ({ page }) => {
      const uniqueSuffix = `${Date.now()}`.slice(-5)
      const inviteEmail = `alex.rivera.${uniqueSuffix}@nvaramedia.com`

      await loginAsPm(page)
      await navigateToTeam(page)
      await page.getByRole('button', { name: /Add Team Member/i }).click()

      await page.getByLabel('Full Name').fill('Alex Rivera')
      await page.getByLabel('Work Email Address').fill(inviteEmail)

      await page.getByRole('button', { name: 'Generate Invite Link', exact: true }).click()

      await expect(page.getByRole('heading', { name: 'Team Member Created' })).toBeVisible({ timeout: 10_000 })
      await expect(page.getByRole('button', { name: 'Copy Invite Link' })).toBeVisible()

      await page.getByRole('button', { name: 'Done' }).click()
    })

    test('PM can deactivate a member with the Smart Workload Rebalancer modal', async ({ page }) => {
      await loginAsPm(page)
      await navigateToTeam(page)

      const rohanRow = page.locator('tr').filter({ hasText: 'rohan.mehta@nvaramedia.com' })
      await expect(rohanRow).toBeVisible()

      const deactivateBtn = rohanRow.getByRole('button', { name: 'Deactivate' })
      if (await deactivateBtn.isVisible()) {
        await deactivateBtn.click()

        await expect(page.getByText(/Deactivate Rohan Mehta/i)).toBeVisible()
        await Promise.all([
          page.waitForResponse((resp) => resp.url().includes('/v1/pm/users') && resp.status() === 200),
          page.getByRole('button', { name: 'Deactivate Member' }).click(),
        ])

        await expect(rohanRow.getByText('Deactivated', { exact: true })).toBeVisible({ timeout: 10_000 })

        await Promise.all([
          page.waitForResponse((resp) => resp.url().includes('/v1/pm/users') && resp.status() === 200),
          rohanRow.getByRole('button', { name: 'Reactivate' }).click(),
        ])
        await expect(rohanRow.getByText('Active', { exact: true })).toBeVisible({ timeout: 10_000 })
      }
    })
  })

  test.describe('Profile & Multi-Device Session Management', () => {
    test('User can inspect account details, view active sessions, and change password with strength meter', async ({
      page,
    }) => {
      const uniqueSuffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`.slice(-5)
      const testEmail = `sec.user.${uniqueSuffix}@nvaramedia.com`
      const initialPass = 'Test#Pass12345!'
      const newPass = 'Updated#Pass54321!'

      // 1. Admin provisions user with instant password
      await loginAsPm(page)
      await navigateToTeam(page)
      await page.getByRole('button', { name: /Add Team Member/i }).click()
      await page.getByRole('button', { name: /Temp Password/i }).first().click()
      await page.getByLabel('Full Name').fill('Security User')
      await page.getByLabel('Work Email Address').fill(testEmail)
      await page.getByLabel('Initial Password (Optional)').fill(initialPass)
      await page.getByRole('button', { name: 'Add Member', exact: true }).click()
      await expect(page.getByRole('heading', { name: 'Team Member Created' })).toBeVisible({ timeout: 10_000 })
      await page.getByRole('button', { name: 'Done' }).click()

      // 2. Sign out
      const signOutBtn = page.getByRole('button', { name: 'Sign out' })
      if (await signOutBtn.isVisible()) {
        await signOutBtn.click()
      } else {
        const menuBtn = page.getByRole('button', { name: 'Open navigation' })
        if (await menuBtn.isVisible()) {
          await menuBtn.click()
          await page.waitForTimeout(300)
          await page.locator('aside').getByRole('button', { name: 'Sign out' }).last().click()
        }
      }

      // 3. Open operations workspace login from landing
      await page.getByRole('button', { name: /operations workspace/i }).click()

      // 4. Log in as new user
      await page.getByLabel('Work Email').fill(testEmail)
      await page.locator('input#password').fill(initialPass)
      await Promise.all([
        page.waitForResponse((res) => res.url().includes('/v1/auth/login') && res.status() === 200),
        page.getByRole('button', { name: 'Sign in' }).click(),
      ])
      await page.waitForTimeout(400)

      // 5. Open profile modal
      await openProfileModal(page)
      await expect(page.getByText('Account Details')).toBeVisible()

      // Switch to Active Devices tab
      await page.getByRole('button', { name: /Active Devices/i }).click()
      await expect(page.getByText('Active Logins')).toBeVisible()
      await expect(page.getByText('Current Device')).toBeVisible()

      // Switch to Security & Password tab
      await page.getByRole('button', { name: /Security & Password/i }).click()
      await expect(page.getByLabel('Current Password')).toBeVisible()

      // Fill new password and verify strength meter
      await page.getByLabel('Current Password').fill(initialPass)
      await page.getByLabel('New Password', { exact: true }).fill(newPass)
      await expect(page.getByText('Password Strength')).toBeVisible()

      await page.getByLabel('Confirm New Password').fill(newPass)
      await page.getByRole('button', { name: 'Update Password' }).click()
      await expect(page.getByRole('status')).toContainText(/changed successfully/i)

      await page.getByLabel('Close profile modal').click()
    })
  })

  test.describe('Forgot Password Flow & One-Time Token Reset', () => {
    test('User can request password reset, navigate to reset page, and set new password with live entropy meter', async ({
      page,
    }) => {
      await page.goto('/')
      await page.getByRole('button', { name: /operations workspace/i }).click()

      await page.getByRole('button', { name: /Forgot password\?/i }).click()
      await expect(page.getByRole('heading', { name: 'Reset Your Password' })).toBeVisible()

      await page.getByLabel('Work Email Address').fill('priya.sharma@nvaramedia.com')
      await page.getByRole('button', { name: 'Send Reset Link' }).click()

      await expect(page.getByText('Reset instructions generated')).toBeVisible({ timeout: 10_000 })

      await expect(page.getByRole('button', { name: /Open Password Reset Page/i })).toBeVisible({ timeout: 10_000 })
      await page.getByRole('button', { name: /Open Password Reset Page/i }).click()

      await expect(page.getByRole('heading', { name: 'Set New Password' })).toBeVisible({ timeout: 15_000 })

      await page.getByLabel('New Password', { exact: true }).fill('Priya#Ops2026!Dev')
      await expect(page.getByText('Password Strength')).toBeVisible()

      await page.getByLabel('Confirm New Password').fill('Priya#Ops2026!Dev')
      await page.getByRole('button', { name: 'Set New Password' }).click()

      await expect(page.getByText('Password Reset Successfully')).toBeVisible({ timeout: 10_000 })
      await page.getByRole('button', { name: 'Sign In with New Password' }).click()

      await expect(page.getByRole('heading', { name: 'Sign in to Operations' })).toBeVisible()
    })
  })
})
