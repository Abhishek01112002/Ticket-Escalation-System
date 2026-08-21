import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'

/**
 * Generates a cryptographically strong, memory-hard Scrypt password hash with unique random salt.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
  return `${salt}:${derivedKey.toString('hex')}`
}

/**
 * Verifies a plaintext password against a stored Scrypt hash in constant time.
 */
export function verifyPassword(password: string, combinedHash: string | null | undefined): boolean {
  if (!combinedHash || typeof combinedHash !== 'string') return false
  try {
    const parts = combinedHash.split(':')
    if (parts.length !== 2) return false
    const [salt, key] = parts
    if (!salt || !key) return false
    const keyBuffer = Buffer.from(key, 'hex')
    const derivedKey = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 })
    if (keyBuffer.length !== derivedKey.length) return false
    return timingSafeEqual(keyBuffer, derivedKey)
  } catch {
    return false
  }
}

/**
 * Generates a 256-bit cryptographically secure raw session token and its corresponding SHA-256 storage hash.
 */
export function generateSessionToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  return { rawToken, tokenHash }
}

/**
 * Computes the SHA-256 hash of a raw session token for database lookup.
 */
export function hashSessionToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

/**
 * Generates a 256-bit cryptographically secure raw password reset token and its SHA-256 hash.
 */
export function generatePasswordResetToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  return { rawToken, tokenHash }
}

/**
 * Computes the SHA-256 hash of a raw password reset token for database verification.
 */
export function hashPasswordResetToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

/**
 * Generates a 256-bit cryptographically secure raw invitation token and its SHA-256 hash.
 */
export function generateInvitationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString('hex')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  return { rawToken, tokenHash }
}

/**
 * Computes the SHA-256 hash of a raw invitation token for database verification.
 */
export function hashInvitationToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

/**
 * Generates a high-entropy, human-friendly temporary password for new team members.
 */
export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$'
  const bytes = randomBytes(12)
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += chars[bytes[i] % chars.length]
  }
  return result
}

