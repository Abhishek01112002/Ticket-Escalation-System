import { useState } from 'react'
import type { CreateRequestInput } from '../../domain/ticket'
import type { SubmissionConfirmation } from '../../services/clientRequestApi'
import { RequestForm } from './RequestForm'
import { ConfirmationScreen } from './ConfirmationScreen'

interface ClientPortalProps {
  onSubmit(input: CreateRequestInput): Promise<SubmissionConfirmation>
  onBack(): void
  /** Navigate to the public tracker with this reference pre-filled.
   *  Reference is passed via prop — never placed in the URL. */
  onTrackRequest?(reference: string): void
}

type ClientView = 'form' | 'confirmation'

export function ClientPortal({ onSubmit, onBack, onTrackRequest }: ClientPortalProps) {
  const [view, setView] = useState<ClientView>('form')
  const [confirmedRequest, setConfirmedRequest] = useState<SubmissionConfirmation | null>(null)

  const handleSubmit = async (input: CreateRequestInput) => {
    const result = await onSubmit(input)
    setConfirmedRequest(result)
    setView('confirmation')
    return result
  }

  if (view === 'confirmation' && confirmedRequest) {
    return (
      <ConfirmationScreen
        request={confirmedRequest}
        onBack={onBack}
        onTrackRequest={onTrackRequest}
      />
    )
  }

  return <RequestForm onSubmit={handleSubmit} onBack={onBack} />
}
