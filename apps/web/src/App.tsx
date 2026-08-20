import { useCallback, useEffect, useRef, useState } from 'react'
import { ClientPortal } from './components/client/ClientPortal'
import { ProductionPMPortal } from './components/pm/ProductionPMPortal'
import { Landing, type ActivePortal } from './components/landing/Landing'
import type { CreateRequestInput, Request, User } from './domain/ticket'
import { submitClientRequest } from './services/clientRequestApi'
import { getPmMe, getPmRequest, listPmRequests } from './services/pmRequestApi'

export type { ActivePortal }

export default function App() {
  const [portal, setPortal] = useState<ActivePortal>('landing')
  const [requests, setRequests] = useState<Request[]>([])
  const [pmUser, setPmUser] = useState<User | null>(null)
  const [pmLoading, setPmLoading] = useState(false)
  const [pmError, setPmError] = useState<string | null>(null)
  const didAutoOpen = useRef(false)

  const openPm = useCallback(async () => {
    setPortal('pm')
    setPmLoading(true)
    setPmError(null)
    try {
      const [user, items] = await Promise.all([getPmMe(), listPmRequests()])
      setPmUser(user)
      setRequests(items)
      sessionStorage.setItem('nvara.pm.session', '1')
    } catch (err) {
      setPmError(err instanceof Error ? err.message : 'Unable to load the PM portal.')
    } finally {
      setPmLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!didAutoOpen.current && sessionStorage.getItem('nvara.pm.session')) {
      didAutoOpen.current = true
      void openPm()
    }
  }, [openPm])

  const handleClientSubmit = (input: CreateRequestInput) => submitClientRequest(input)

  if (portal === 'client') {
    return (
      <ClientPortal
        onSubmit={handleClientSubmit}
        onBack={() => setPortal('landing')}
      />
    )
  }

  if (portal === 'pm') {
    return (
      <ProductionPMPortal
        user={
          pmUser ?? {
            id: 'pm',
            name: 'Project Manager',
            initials: 'PM',
            role: 'project_manager',
            team: '',
          }
        }
        requests={requests}
        loading={pmLoading}
        error={pmError}
        retry={() => void openPm()}
        onOpen={getPmRequest}
        onBack={() => {
          sessionStorage.removeItem('nvara.pm.session')
          setPortal('landing')
        }}
      />
    )
  }

  return <Landing onPortal={(next) => (next === 'pm' ? void openPm() : setPortal(next))} />
}
