-- 0009_request_soft_delete.sql
-- Add soft-delete capability to requests table to preserve permanent immutable audit integrity

ALTER TABLE requests ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS requests_org_status_deleted_idx ON requests (organization_id, status) WHERE deleted_at IS NULL;

-- Expand audit_event_type_allowed check constraint to include 'request_deleted'
ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_event_type_allowed;
ALTER TABLE audit_events ADD CONSTRAINT audit_event_type_allowed CHECK (
  event_type IN (
    'request_created',
    'assigned',
    'reassigned',
    'acknowledged',
    'work_started',
    'resolved',
    'request_deleted',
    'sla_breached',
    'escalation_triggered',
    'USER_INVITED',
    'USER_ONBOARDED',
    'USER_CREATED',
    'USER_DEACTIVATED',
    'USER_REACTIVATED',
    'ROLE_CHANGED',
    'PASSWORD_CHANGED',
    'PASSWORD_RESET_REQUESTED',
    'PASSWORD_RESET_COMPLETED',
    'SESSIONS_REVOKED',
    'REMOTE_SESSIONS_REVOKED'
  )
);
