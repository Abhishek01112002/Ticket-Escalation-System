import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { evaluatePassword } from '../../apps/web/src/components/ui/PasswordStrengthMeter'

describe('Password Strength & Entropy Analyzer', () => {
  test('rejects short passwords as Weak', () => {
    const res = evaluatePassword('abc')
    assert.equal(res.score, 0)
    assert.equal(res.label, 'Weak')
    assert.equal(res.hasMinLength, false)
  })

  test('recognizes 8+ lowercase as score 1 (Weak)', () => {
    const res = evaluatePassword('password')
    assert.equal(res.hasMinLength, true)
    assert.equal(res.hasMixedCase, false)
    assert.equal(res.hasNumber, false)
    assert.equal(res.hasSpecialChar, false)
    assert.equal(res.score, 1)
    assert.equal(res.label, 'Weak')
  })

  test('recognizes mixed case and length as score 2 (Fair)', () => {
    const res = evaluatePassword('PasswordTest')
    assert.equal(res.hasMinLength, true)
    assert.equal(res.hasMixedCase, true)
    assert.equal(res.score, 2)
    assert.equal(res.label, 'Fair')
  })

  test('recognizes mixed case, length, and numbers as score 3 (Good)', () => {
    const res = evaluatePassword('Password123')
    assert.equal(res.hasMinLength, true)
    assert.equal(res.hasMixedCase, true)
    assert.equal(res.hasNumber, true)
    assert.equal(res.score, 3)
    assert.equal(res.label, 'Good')
  })

  test('recognizes complex 10+ char password with special symbols as score 4 (Strong)', () => {
    const res = evaluatePassword('Secure#Pass2026!')
    assert.equal(res.hasMinLength, true)
    assert.equal(res.hasMixedCase, true)
    assert.equal(res.hasNumber, true)
    assert.equal(res.hasSpecialChar, true)
    assert.equal(res.score, 4)
    assert.equal(res.label, 'Strong')
  })
})
