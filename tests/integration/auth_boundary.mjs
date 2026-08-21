import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'

const base = process.env.API_ORIGIN ?? 'http://127.0.0.1:4000'
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL })

console.log('--- Starting Auth & Session Boundary Tests ---')

// Helper to extract cookie value
function getSessionCookie(res) {
  const setCookie = res.headers.get('set-cookie')
  if (!setCookie) return null
  const match = setCookie.match(/nvara_session=([^;]+)/)
  return match ? match[1] : null
}

// 1. Unauthenticated PM route returns 401
const unauthRes = await fetch(`${base}/v1/pm/requests`)
assert.equal(unauthRes.status, 401, 'Unauthenticated PM request must return 401')
const unauthBody = await unauthRes.json()
assert.equal(unauthBody.error.code, 'UNAUTHENTICATED')
console.log('✓ Test 1 Passed: Unauthenticated PM request returned 401')

// 2. Invalid password returns generic 401
const badPassRes = await fetch(`${base}/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'pm@nvaramedia.com', password: 'WrongPassword123!' }),
})
assert.equal(badPassRes.status, 401, 'Wrong password must return 401')
const badPassBody = await badPassRes.json()
assert.equal(badPassBody.error.message, 'Invalid email or password.')
console.log('✓ Test 2 Passed: Wrong password returned generic 401')

// 3. Unknown email returns identical generic 401
const badEmailRes = await fetch(`${base}/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'nonexistent.user@nvaramedia.com', password: 'AnyPassword123!' }),
})
assert.equal(badEmailRes.status, 401, 'Unknown email must return 401')
const badEmailBody = await badEmailRes.json()
assert.equal(badEmailBody.error.message, 'Invalid email or password.')
console.log('✓ Test 3 Passed: Unknown email returned identical generic 401')

// 4. Valid PM login returns 200, sets HttpOnly cookie, and returns safe user profile
const pmPass = process.env.DEV_PM_PASSWORD || 'Nvara#PM2026!Secure'
const pmLoginRes = await fetch(`${base}/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'pm@nvaramedia.com', password: pmPass }),
})
assert.equal(pmLoginRes.status, 200, 'Valid PM credentials must return 200')
const pmLoginBody = await pmLoginRes.json()
assert.equal(pmLoginBody.user.email, 'pm@nvaramedia.com')
assert.equal(pmLoginBody.user.role, 'project_manager')
assert.equal(pmLoginBody.user.passwordHash, undefined, 'Password hash must never be returned')
assert.equal(pmLoginBody.token, undefined, 'Raw session token must not be in JSON body')

const pmCookieRaw = getSessionCookie(pmLoginRes)
assert.ok(pmCookieRaw, 'HttpOnly session cookie must be set')
const setCookieHeader = pmLoginRes.headers.get('set-cookie')
assert.ok(setCookieHeader.toLowerCase().includes('httponly'), 'Cookie must have HttpOnly flag')
assert.ok(setCookieHeader.toLowerCase().includes('samesite=lax'), 'Cookie must have SameSite=Lax flag')
console.log('✓ Test 4 Passed: Valid PM login issued HttpOnly cookie and safe profile')

// 5. GET /v1/auth/me resolves active session
const meRes = await fetch(`${base}/v1/auth/me`, {
  headers: { Cookie: `nvara_session=${pmCookieRaw}` },
})
assert.equal(meRes.status, 200, '/v1/auth/me with session cookie must return 200')
const meBody = await meRes.json()
assert.equal(meBody.user.email, 'pm@nvaramedia.com')
assert.equal(meBody.user.role, 'project_manager')
console.log('✓ Test 5 Passed: GET /v1/auth/me resolved active session')

// 6. PM Operations Queue accessible with session cookie
const queueRes = await fetch(`${base}/v1/pm/requests`, {
  headers: { Cookie: `nvara_session=${pmCookieRaw}` },
})
assert.equal(queueRes.status, 200, 'Operations queue must return 200 for authenticated PM')
const queueBody = await queueRes.json()
assert.ok(Array.isArray(queueBody.requests), 'Queue must return array of requests')
console.log('✓ Test 6 Passed: Operations queue accessible with session cookie')

// 7. Specialist login & role check
const rohanPass = process.env.DEV_ROHAN_PASSWORD || 'Rohan#Ops2026!Dev'
const specialistLoginRes = await fetch(`${base}/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'rohan.mehta@nvaramedia.com', password: rohanPass }),
})
assert.equal(specialistLoginRes.status, 200)
const specialistBody = await specialistLoginRes.json()
assert.equal(specialistBody.user.role, 'internal_team_member')
const specialistCookie = getSessionCookie(specialistLoginRes)

// 8. Specialist cannot assign (PM only) -> 403 Forbidden
const assignRes = await fetch(`${base}/v1/pm/requests/${queueBody.requests[0].reference}/assignments`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Cookie: `nvara_session=${specialistCookie}`,
    'Idempotency-Key': `test-assign-${randomUUID()}`,
  },
  body: JSON.stringify({ expectedVersion: 1, assigneeUserId: specialistBody.user.id }),
})
assert.equal(assignRes.status, 403, 'Specialist must be forbidden from assignment mutation')
console.log('✓ Test 8 Passed: Role-based authorization enforced (Specialist forbidden from assignments)')

// 9. Logout revokes session and clears cookie
const logoutRes = await fetch(`${base}/v1/auth/logout`, {
  method: 'POST',
  headers: { Cookie: `nvara_session=${pmCookieRaw}` },
})
assert.equal(logoutRes.status, 200)
const logoutCookieHeader = logoutRes.headers.get('set-cookie')
assert.ok(logoutCookieHeader.includes('Max-Age=0'), 'Logout must clear cookie with Max-Age=0')

// 10. Subsequent request with revoked session fails with 401
const revokedRes = await fetch(`${base}/v1/auth/me`, {
  headers: { Cookie: `nvara_session=${pmCookieRaw}` },
})
assert.equal(revokedRes.status, 401, 'Revoked session must return 401')
console.log('✓ Test 10 Passed: Logout revoked session and blocked subsequent access')

// 11. Public Client Portal submission works without authentication
const clientRes = await fetch(`${base}/v1/client/requests`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': `pub-client-${randomUUID()}`,
  },
  body: JSON.stringify({
    name: 'Public Client Tester',
    company: 'Acme Test Corp',
    email: `public-${randomUUID()}@example.test`,
    phone: '+91 99887 76655',
    serviceDomain: 'digital_marketing',
    requirement: 'Public request created without authentication.',
    urgency: 'flexible',
  }),
})
assert.equal(clientRes.status, 201, 'Public client intake must succeed without authentication')
console.log('✓ Test 11 Passed: Public Client Portal submission succeeded without auth')

await db.end()
console.log('All 11 Auth & Session Boundary Integration Tests Passed Successfully! 🎉')
