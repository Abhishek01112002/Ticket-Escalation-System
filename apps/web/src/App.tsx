import { useCallback, useEffect, useState } from 'react'
import { ClientPortal } from './components/client/ClientPortal'
import { ProductionPMPortal } from './components/pm/ProductionPMPortal'
import { LoginScreen } from './components/auth/LoginScreen'
import { ResetPasswordScreen } from './components/auth/ResetPasswordScreen'
import { InviteOnboardingScreen } from './components/auth/InviteOnboardingScreen'
import { Landing, type ActivePortal } from './components/landing/Landing'
import { RequestTrackerScreen } from './components/tracker/RequestTrackerScreen'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import type { CreateRequestInput, Request, User } from './domain/ticket'
import { submitClientRequest } from './services/clientRequestApi'
import { getPmRequest, listPmRequests } from './services/pmRequestApi'
import { getCurrentUser, logoutUser } from './services/authApi'

export type PortalState = 'landing' | 'client' | 'login' | 'pm' | 'tracker' | 'reset-password' | 'invite'

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}

function AppContent() {
  const [portal, setPortal] = useState<PortalState>('landing')
  const [requests, setRequests] = useState<Request[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [pmLoading, setPmLoading] = useState(false)
  const [pmError, setPmError] = useState<string | null>(null)
  // Pre-fill reference for tracker — passed as prop, never placed in the URL
  const [trackerPrefill, setTrackerPrefill] = useState<string | undefined>(undefined)
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [inviteToken, setInviteToken] = useState<string | null>(null)

  const loadPmRequests = useCallback(async () => {
    setPmLoading(true)
    setPmError(null)
    try {
      const items = await listPmRequests()
      setRequests(items)
    } catch (err) {
      setPmError(err instanceof Error ? err.message : 'Unable to load operational requests.')
    } finally {
      setPmLoading(false)
    }
  }, [])

  // Restore authenticated session on initial mount & check for reset or invite token
  useEffect(() => {
    let active = true

    // Check URL query parameters
    const urlParams = new URLSearchParams(window.location.search)
    const inviteFromUrl = urlParams.get('invite')
    const tokenFromUrl = urlParams.get('token')

    if (inviteFromUrl && inviteFromUrl.length >= 16) {
      setInviteToken(inviteFromUrl)
      setPortal('invite')
      window.history.replaceState({}, document.title, window.location.pathname)
      return
    }

    if (tokenFromUrl && tokenFromUrl.length >= 16) {
      setResetToken(tokenFromUrl)
      setPortal('reset-password')
      window.history.replaceState({}, document.title, window.location.pathname)
      return
    }

    getCurrentUser()
      .then((user) => {
        if (!active) return
        if (user) {
          setCurrentUser(user)
          setPortal('pm')
          void loadPmRequests()
        }
      })
      .catch(() => {
        // Unauthenticated or network error on mount
      })

    return () => {
      active = false
    }
  }, [loadPmRequests])

  const handlePortalSelect = (target: ActivePortal) => {
    if (target === 'client') {
      setPortal('client')
    } else if (target === 'pm') {
      if (currentUser) {
        setPortal('pm')
        void loadPmRequests()
      } else {
        setPortal('login')
      }
    } else if (target === 'tracker') {
      setTrackerPrefill(undefined)
      setPortal('tracker')
    } else {
      setPortal('landing')
    }
  }

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user)
    setPortal('pm')
    void loadPmRequests()
  }

  const handleSignOut = async () => {
    await logoutUser()
    setCurrentUser(null)
    setRequests([])
    setPortal('landing')
  }

  const handleClientSubmit = (input: CreateRequestInput) => submitClientRequest(input)

  /** Called from ConfirmationScreen CTA — navigate to tracker with reference
   *  pre-filled via prop. The reference is NOT appended to the URL. */
  const handleTrackRequest = (reference: string) => {
    setTrackerPrefill(reference)
    setPortal('tracker')
  }

  const handleNavigateToReset = (token: string) => {
    setResetToken(token)
    setPortal('reset-password')
  }

  if (portal === 'client') {
    return (
      <ClientPortal
        onSubmit={handleClientSubmit}
        onBack={() => setPortal('landing')}
        onTrackRequest={handleTrackRequest}
      />
    )
  }

  if (portal === 'login') {
    return (
      <LoginScreen
        onSuccess={handleLoginSuccess}
        onBack={() => setPortal('landing')}
        onResetPasswordToken={handleNavigateToReset}
      />
    )
  }

  if (portal === 'invite') {
    return (
      <InviteOnboardingScreen
        token={inviteToken || ''}
        onOnboardingComplete={(user) => {
          setInviteToken(null)
          setCurrentUser(user)
          setPortal('pm')
          void loadPmRequests()
        }}
        onCancel={() => {
          setInviteToken(null)
          setPortal('landing')
        }}
      />
    )
  }

  if (portal === 'reset-password') {
    return (
      <ResetPasswordScreen
        token={resetToken || ''}
        onSuccess={() => {
          setResetToken(null)
          setPortal('login')
        }}
        onBack={() => {
          setResetToken(null)
          setPortal('login')
        }}
      />
    )
  }

  if (portal === 'tracker') {
    return (
      <RequestTrackerScreen
        onBack={() => setPortal('landing')}
        prefillReference={trackerPrefill}
      />
    )
  }

  if (portal === 'pm') {
    if (!currentUser) {
      return (
        <LoginScreen
          onSuccess={handleLoginSuccess}
          onBack={() => setPortal('landing')}
        />
      )
    }

    return (
      <ProductionPMPortal
        user={currentUser}
        requests={requests}
        loading={pmLoading}
        error={pmError}
        retry={() => void loadPmRequests()}
        onOpen={getPmRequest}
        onBack={() => setPortal('landing')}
        onSignOut={handleSignOut}
      />
    )
  }

  return <Landing onPortal={handlePortalSelect} />
}
