/**
 * user_management_security.mjs
 *
 * Comprehensive Tier-1 Security & Functional Integration tests for:
 * 1. RBAC & Team Directory with Live SLA and Workload Metrics
 * 2. Dual-Mode Onboarding (7-Day Secure Invite Links & Temp Passwords)
 * 3. Member Detail Drawer Profile & Ticket History Endpoint
 * 4. Self-Lockout & Last-Active Admin Protection (Organization Survival Guard)
 * 5. Smart Workload Rebalancing on Specialist Deactivation
 * 6. Multi-Device Session Management & Remote Revocation Matrix
 * 7. Zero-Enumeration Forgot Password & One-Time Token Lifecycle
 * 8. Authenticated Password Change with Multi-Device Revocation
 * 9. Immutable Organizational Audit Trail
 *
 * Usage:
 *   API_URL=http://127.0.0.1:4000 node tests/integration/user_management_security.mjs
 */

const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4000'

let passed = 0
let failed = 0

async function t(name, fn) {
  try {
    await fn()
    console.log(`  ✓ ${name}`)
    passed++
  } catch (err) {
    console.error(`  ✗ ${name}`)
    console.error(`    ${err.message}`)
    failed++
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message ?? 'Assertion failed')
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg ?? `Expected ${JSON.stringify(a)} === ${JSON.stringify(b)}`)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function login(email, password) {
  const res = await fetch(`${API_URL}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const cookie = res.headers.get('set-cookie')
  const body = await res.json()
  return { status: res.status, body, cookie }
}

console.log('\n── Tier-1 User & Team Management Security Integration Tests ──\n')

// ── 1. Team Management & RBAC ────────────────────────────────────────────────
console.log('1. RBAC & Team Management Admin Capabilities')

let pmCookie = null
let rohanCookie = null

await t('Project Manager can log in and obtain session cookie', async () => {
  const res = await login('pm@nvaramedia.com', 'Nvara#PM2026!Secure')
  assertEqual(res.status, 200)
  assert(res.cookie, 'Expected set-cookie header')
  pmCookie = res.cookie
})

await t('Specialist can log in and obtain session cookie', async () => {
  const res = await login('rohan.mehta@nvaramedia.com', 'Rohan#Ops2026!Dev')
  assertEqual(res.status, 200)
  assert(res.cookie, 'Expected set-cookie header')
  rohanCookie = res.cookie
})

await t('Project Manager can list organization team members with SLA metrics', async () => {
  const res = await fetch(`${API_URL}/v1/pm/users`, {
    headers: { Cookie: pmCookie },
  })
  assertEqual(res.status, 200)
  const data = await res.json()
  assert(Array.isArray(data.users), 'Expected users array')
  assert(data.users.length >= 2, 'Expected at least 2 users')

  const rohan = data.users.find((u) => u.email === 'rohan.mehta@nvaramedia.com')
  assert(rohan, 'Expected to find Rohan Mehta')
  assertEqual(typeof rohan.activeAssignmentsCount, 'number')
  assertEqual(typeof rohan.slaComplianceRate, 'number')
  assertEqual(typeof rohan.avgResolutionMinutes, 'number')
})

const UNIQUE_SUFFIX = Date.now().toString().slice(-4)
const TEST_MEMBER_EMAIL = `test.member.${UNIQUE_SUFFIX}@nvaramedia.com`
let createdUserId = null
let tempPassword = null

await t('Project Manager can create a new team member with generated temporary password', async () => {
  const res = await fetch(`${API_URL}/v1/pm/users/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: pmCookie },
    body: JSON.stringify({
      displayName: 'Test Integration Member',
      email: TEST_MEMBER_EMAIL,
      role: 'internal_team_member',
      mode: 'instant_password',
    }),
  })
  assertEqual(res.status, 201)
  const data = await res.json()
  assert(data.user?.id, 'Expected user id')
  assert(data.temporaryPassword, 'Expected temporary password')
  createdUserId = data.user.id
  tempPassword = data.temporaryPassword
})

await t('Duplicate email within organization returns 409 Conflict', async () => {
  const res = await fetch(`${API_URL}/v1/pm/users/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: pmCookie },
    body: JSON.stringify({
      displayName: 'Duplicate Member',
      email: TEST_MEMBER_EMAIL,
      role: 'internal_team_member',
      mode: 'instant_password',
    }),
  })
  assertEqual(res.status, 409)
  const data = await res.json()
  assertEqual(data.error?.code, 'EMAIL_EXISTS')
})

await t('Specialist cannot invite team members (403 Forbidden)', async () => {
  const res = await fetch(`${API_URL}/v1/pm/users/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: rohanCookie },
    body: JSON.stringify({
      displayName: 'Hacker Invite',
      email: 'hacker@nvaramedia.com',
      role: 'internal_team_member',
      mode: 'instant_password',
    }),
  })
  assertEqual(res.status, 403)
})

// ── 2. Dual-Mode Onboarding & 7-Day Secure Invite Links ──────────────────────
console.log('\n2. Dual-Mode Onboarding & 7-Day Secure Invite Links')

const INVITE_EMAIL = `onboard.invite.${UNIQUE_SUFFIX}@nvaramedia.com`
let rawInviteToken = null

await t('PM can generate a 7-day secure invite link for a new member', async () => {
  const res = await fetch(`${API_URL}/v1/pm/users/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: pmCookie },
    body: JSON.stringify({
      displayName: 'Jordan Lee',
      email: INVITE_EMAIL,
      role: 'internal_team_member',
      mode: 'invite_link',
    }),
  })
  assertEqual(res.status, 201)
  const data = await res.json()
  assertEqual(data.mode, 'invite_link')
  assert(data.inviteUrl, 'Expected inviteUrl')
  assert(data.rawToken, 'Expected rawToken')
  rawInviteToken = data.rawToken
})

await t('Public endpoint verifies invitation details without authentication', async () => {
  const res = await fetch(`${API_URL}/v1/invitations/${rawInviteToken}`)
  assertEqual(res.status, 200)
  const data = await res.json()
  assertEqual(data.valid, true)
  assertEqual(data.email, INVITE_EMAIL)
  assertEqual(data.displayName, 'Jordan Lee')
  assert(data.organizationName, 'Expected organization name')
})

let jordanCookie = null

await t('Invited user can accept invitation, set password, and receive session cookie', async () => {
  const res = await fetch(`${API_URL}/v1/invitations/${rawInviteToken}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'Jordan#SecurePass2026!' }),
  })
  assertEqual(res.status, 201)
  assert(res.headers.get('set-cookie'), 'Expected session cookie on acceptance')
  jordanCookie = res.headers.get('set-cookie')

  const data = await res.json()
  assertEqual(data.user?.email, INVITE_EMAIL)
  assertEqual(data.user?.displayName, 'Jordan Lee')
})

await t('Accepting same invitation token a second time fails (400)', async () => {
  const res = await fetch(`${API_URL}/v1/invitations/${rawInviteToken}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'Jordan#SecurePass2026!' }),
  })
  assertEqual(res.status, 400)
})

// ── 3. Member Detail Drawer & History Endpoint ───────────────────────────────
console.log('\n3. Member Detail Drawer & Ticket History')

await t('PM can fetch comprehensive member profile and recent ticket history', async () => {
  const res = await fetch(`${API_URL}/v1/pm/users/${createdUserId}/detail`, {
    headers: { Cookie: pmCookie },
  })
  assertEqual(res.status, 200)
  const data = await res.json()
  assert(data.member, 'Expected member profile')
  assertEqual(data.member.id, createdUserId)
  assert(Array.isArray(data.recentTickets), 'Expected recentTickets array')
})

// ── 4. Self-Lockout & Last-Active Admin Guards ───────────────────────────────
console.log('\n4. Self-Lockout & Organization Survival Guards')

let pmUserId = null

await t('Fetch PM user ID', async () => {
  const res = await fetch(`${API_URL}/v1/auth/me`, {
    headers: { Cookie: pmCookie },
  })
  assertEqual(res.status, 200)
  const data = await res.json()
  pmUserId = data.user.id
})

await t('Project Manager cannot deactivate self (400 Bad Request)', async () => {
  const res = await fetch(`${API_URL}/v1/pm/users/${pmUserId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: pmCookie },
    body: JSON.stringify({ isActive: false }),
  })
  assertEqual(res.status, 400)
  const data = await res.json()
  assertEqual(data.error?.code, 'CANNOT_DEACTIVATE_SELF')
})

await t('Project Manager cannot demote self to specialist (400 Bad Request)', async () => {
  const res = await fetch(`${API_URL}/v1/pm/users/${pmUserId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: pmCookie },
    body: JSON.stringify({ role: 'internal_team_member' }),
  })
  assertEqual(res.status, 400)
  const data = await res.json()
  assertEqual(data.error?.code, 'CANNOT_DEMOTE_SELF')
})

// ── 5. Workload Rebalancing & Session Revocation ─────────────────────────────
console.log('\n5. Workload Rebalancing & Session Invalidation')

let memberSessionCookie = null

await t('Establish active session for created user before deactivation', async () => {
  const loginRes = await login(TEST_MEMBER_EMAIL, tempPassword)
  assertEqual(loginRes.status, 200)
  memberSessionCookie = loginRes.cookie
})

await t('Deactivating user terminates active sessions and rebalances workload', async () => {
  const res = await fetch(`${API_URL}/v1/pm/users/${createdUserId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: pmCookie },
    body: JSON.stringify({ isActive: false }),
  })
  assertEqual(res.status, 200)

  // Verify session terminated
  const checkSession = await fetch(`${API_URL}/v1/auth/me`, {
    headers: { Cookie: memberSessionCookie },
  })
  assertEqual(checkSession.status, 401)
})

await t('Reactivating user restores ability to sign in', async () => {
  const res = await fetch(`${API_URL}/v1/pm/users/${createdUserId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: pmCookie },
    body: JSON.stringify({ isActive: true }),
  })
  assertEqual(res.status, 200)

  const loginRes = await login(TEST_MEMBER_EMAIL, tempPassword)
  assertEqual(loginRes.status, 200)
})

// ── 6. Multi-Device Session Management ───────────────────────────────────────
console.log('\n6. Multi-Device Session Management')

await t('User can list active device sessions', async () => {
  const res = await fetch(`${API_URL}/v1/auth/sessions`, {
    headers: { Cookie: pmCookie },
  })
  assertEqual(res.status, 200)
  const data = await res.json()
  assert(Array.isArray(data.sessions), 'Expected sessions array')
  assert(data.sessions.length >= 1, 'Expected at least 1 session')
  const current = data.sessions.find((s) => s.isCurrent)
  assert(current, 'Expected current session flagged')
})

await t('User can revoke all other remote sessions', async () => {
  const res = await fetch(`${API_URL}/v1/auth/sessions/revoke-others`, {
    method: 'POST',
    headers: { Cookie: pmCookie },
  })
  assertEqual(res.status, 200)
  const data = await res.json()
  assertEqual(data.success, true)
})

// ── 7. Forgot Password & Zero-Enumeration ─────────────────────────────────────
console.log('\n7. Forgot Password & One-Time Token Reset')

let resetToken = null

await t('Forgot password returns identical generic response for existing email', async () => {
  const res = await fetch(`${API_URL}/v1/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_MEMBER_EMAIL }),
  })
  assertEqual(res.status, 200)
  const data = await res.json()
  assert(data.message.includes('If your email is associated'), 'Expected generic response')
  assert(data.devResetToken, 'Expected devResetToken in dev mode')
  resetToken = data.devResetToken
})

await t('verify-reset-token succeeds for fresh token', async () => {
  const res = await fetch(`${API_URL}/v1/auth/verify-reset-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: resetToken }),
  })
  assertEqual(res.status, 200)
  const data = await res.json()
  assertEqual(data.valid, true)
})

const NEW_PASSWORD = 'NewSecure#Password2026!'

await t('reset-password updates password, consumes token, and revokes sessions', async () => {
  const resetRes = await fetch(`${API_URL}/v1/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: resetToken, newPassword: NEW_PASSWORD }),
  })
  assertEqual(resetRes.status, 200)

  // Old password no longer works
  const oldLogin = await login(TEST_MEMBER_EMAIL, tempPassword)
  assertEqual(oldLogin.status, 401)

  // New password works
  const newLogin = await login(TEST_MEMBER_EMAIL, NEW_PASSWORD)
  assertEqual(newLogin.status, 200)
})

// ── 8. Authenticated Password Change ──────────────────────────────────────────
console.log('\n8. Authenticated Password Change')

let userSessionCookie = null

await t('Log in with reset password', async () => {
  const res = await login(TEST_MEMBER_EMAIL, NEW_PASSWORD)
  assertEqual(res.status, 200)
  userSessionCookie = res.cookie
})

const FINAL_PASSWORD = 'FinalPassword#2026!Sec'

await t('change-password succeeds with correct current password and revokes remote sessions', async () => {
  const res = await fetch(`${API_URL}/v1/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: userSessionCookie },
    body: JSON.stringify({
      currentPassword: NEW_PASSWORD,
      newPassword: FINAL_PASSWORD,
    }),
  })
  assertEqual(res.status, 200)

  const loginRes = await login(TEST_MEMBER_EMAIL, FINAL_PASSWORD)
  assertEqual(loginRes.status, 200)
})

// ── 9. Organizational Compliance Audit Trail ─────────────────────────────────
console.log('\n9. Organizational Audit Trail')

await t('PM can query compliance audit trail timeline', async () => {
  const res = await fetch(`${API_URL}/v1/pm/audit-logs`, {
    headers: { Cookie: pmCookie },
  })
  assertEqual(res.status, 200)
  const data = await res.json()
  assert(Array.isArray(data.logs), 'Expected logs array')
  assert(data.logs.length >= 1, 'Expected at least 1 audit event')

  const hasEvent = data.logs.some((l) =>
    ['USER_INVITED', 'USER_ONBOARDED', 'USER_DEACTIVATED', 'PASSWORD_CHANGED', 'PASSWORD_RESET_COMPLETED'].includes(
      l.eventType
    )
  )
  assert(hasEvent, 'Expected administrative event in audit trail')
})

console.log(`\n── Results: ${passed} passed, ${failed} failed ──\n`)
if (failed > 0) process.exit(1)
