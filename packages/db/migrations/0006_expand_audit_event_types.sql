-- 0006_expand_audit_event_types.sql
-- Expand audit_event_type_allowed check constraint to support user management & security audit events

ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_event_type_allowed;
ALTER TABLE audit_events ADD CONSTRAINT audit_event_type_allowed CHECK (
  event_type IN (
    'request_created',
    'assigned',
    'reassigned',
    'acknowledged',
    'work_started',
    'resolved',
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
