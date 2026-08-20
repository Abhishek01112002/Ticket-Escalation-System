import { useState } from 'react'
import type { CreateRequestInput } from '../../domain/ticket'
import type { SubmissionConfirmation } from '../../services/clientRequestApi'
import { RequestForm } from './RequestForm'
import { ConfirmationScreen } from './ConfirmationScreen'

interface ClientPortalProps {
  onSubmit(input: CreateRequestInput): Promise<SubmissionConfirmation>
  onBack(): void
}

type ClientView = 'form' | 'confirmation'

export function ClientPortal({ onSubmit, onBack }: ClientPortalProps) {
  const [view, setView] = useState<ClientView>('form')
  const [confirmedRequest, setConfirmedRequest] = useState<SubmissionConfirmation | null>(null)

  const handleSubmit = async (input: CreateRequestInput) => {
    const result = await onSubmit(input)
    setConfirmedRequest(result)
    setView('confirmation')
    return result
  }

  if (view === 'confirmation' && confirmedRequest) {
    return <ConfirmationScreen request={confirmedRequest} onBack={onBack} />
  }

  return <RequestForm onSubmit={handleSubmit} onBack={onBack} />
}
