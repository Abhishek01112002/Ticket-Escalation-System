import type { User } from '../domain/ticket'

export type AuthResponse = {
  user: User
}

export async function loginUser(email: string, password: string): Promise<User> {
  const res = await fetch('/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const message = data.error?.message || (res.status === 401 ? 'Invalid email or password.' : 'Sign in failed. Please try again.')
    throw new Error(message)
  }

  const data = await res.json()
  return {
    id: data.user.id,
    name: data.user.displayName,
    initials: data.user.displayName
      .split(' ')
      .map((p: string) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    role: data.user.role,
    team: data.user.organizationName,
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const res = await fetch('/v1/auth/me', {
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    })

    if (!res.ok) {
      return null
    }

    const data = await res.json()
    return {
      id: data.user.id,
      name: data.user.displayName,
      initials: data.user.displayName
        .split(' ')
        .map((p: string) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      role: data.user.role,
      team: data.user.organizationName,
    }
  } catch {
    return null
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await fetch('/v1/auth/logout', {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // Ignore network errors on logout
  }
}

export async function requestPasswordReset(
  email: string
): Promise<{ message: string; devResetToken?: string; resetUrl?: string }> {
  const res = await fetch('/v1/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error?.message || 'Unable to request password reset. Please try again.')
  }

  return data
}

export async function verifyResetToken(token: string): Promise<boolean> {
  try {
    const res = await fetch('/v1/auth/verify-reset-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const data = await res.json().catch(() => ({}))
    return Boolean(data.valid)
  } catch {
    return false
  }
}

export async function resetPassword(token: string, newPassword: string): Promise<string> {
  const res = await fetch('/v1/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error?.message || 'Password reset failed. The link may have expired.')
  }

  return data.message || 'Password has been reset successfully.'
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<string> {
  const res = await fetch('/v1/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ currentPassword, newPassword }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to change password.')
  }

  return data.message || 'Password changed successfully.'
}

export interface InvitationDetails {
  valid: boolean
  email: string
  displayName: string
  organizationName: string
  role: 'project_manager' | 'internal_team_member'
  inviterName: string
}

export async function getInvitationDetails(token: string): Promise<InvitationDetails> {
  const res = await fetch(`/v1/invitations/${encodeURIComponent(token)}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error?.message || 'Invalid or expired invitation.')
  }
  return data
}

export async function acceptInvitation(token: string, password: string): Promise<User> {
  const res = await fetch(`/v1/invitations/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ password }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to accept invitation.')
  }

  return {
    id: data.user.id,
    name: data.user.displayName,
    initials: data.user.displayName
      .split(' ')
      .map((p: string) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
    role: data.user.role,
    team: data.user.organizationName,
  }
}

export interface UserSession {
  id: string
  userAgent: string
  ipAddress: string
  createdAt: string
  lastSeenAt: string
  isCurrent: boolean
}

export async function listUserSessions(): Promise<UserSession[]> {
  const res = await fetch('/v1/auth/sessions', {
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to load sessions.')
  }
  return data.sessions || []
}

export async function revokeOtherSessions(): Promise<{ revokedCount: number; message: string }> {
  const res = await fetch('/v1/auth/sessions/revoke-others', {
    method: 'POST',
    credentials: 'include',
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to revoke remote sessions.')
  }
  return data
}


