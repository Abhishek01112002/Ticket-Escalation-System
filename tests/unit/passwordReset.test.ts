/**
 * passwordReset.test.ts
 *
 * Unit tests for cryptographic security helpers used in password reset,
 * session management, and temporary password generation.
 *
 * Run: npx tsx --test tests/unit/passwordReset.test.ts
 */

import assert from 'node:assert/strict'
import { test, describe } from 'node:test'
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  generateTempPassword,
  hashPassword,
  verifyPassword,
} from '../../apps/api/src/crypto.js'

describe('Password Reset Cryptographic Functions', () => {
  test('generatePasswordResetToken generates 256-bit entropy (64 hex characters)', () => {
    const { rawToken, tokenHash } = generatePasswordResetToken()
    assert.equal(rawToken.length, 64)
    assert.equal(tokenHash.length, 64)
    assert.match(rawToken, /^[0-9a-f]{64}$/)
    assert.match(tokenHash, /^[0-9a-f]{64}$/)
  })

  test('hashPasswordResetToken consistently hashes raw token via SHA-256', () => {
    const { rawToken, tokenHash } = generatePasswordResetToken()
    const computedHash = hashPasswordResetToken(rawToken)
    assert.equal(computedHash, tokenHash)
  })

  test('generatePasswordResetToken produces distinct tokens on subsequent invocations', () => {
    const t1 = generatePasswordResetToken()
    const t2 = generatePasswordResetToken()
    assert.notEqual(t1.rawToken, t2.rawToken)
    assert.notEqual(t1.tokenHash, t2.tokenHash)
  })

  test('generateTempPassword generates a 12-character high-entropy password', () => {
    const temp1 = generateTempPassword()
    const temp2 = generateTempPassword()
    assert.equal(temp1.length, 12)
    assert.equal(temp2.length, 12)
    assert.notEqual(temp1, temp2)
  })

  test('hashPassword and verifyPassword correctly hash and verify passwords using Scrypt', async () => {
    const pass = 'SuperSecret#Password2026!'
    const hash = hashPassword(pass)
    assert.ok(hash.includes(':'))
    const [salt, key] = hash.split(':')
    assert.equal(salt.length, 32) // 16 bytes hex
    assert.equal(key.length, 128) // 64 bytes hex

    const isValid = verifyPassword(pass, hash)
    assert.equal(isValid, true)

    const isWrong = verifyPassword('WrongPassword123!', hash)
    assert.equal(isWrong, false)
  })
})
