-- 0010_audit_log_soft_delete.sql
-- Add soft-delete capability to audit_events table to support compliance-safe deletion & retention pruning

ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS audit_events_org_occurred_deleted_idx ON audit_events (organization_id, occurred_at DESC) WHERE deleted_at IS NULL;

-- Update trigger prevent_audit_event_mutation so that UPDATE is only permitted on deleted_at (setting deletion timestamp)
-- while ensuring all audit record payloads (event_type, metadata, actor, timestamps, states) remain 100% immutable
CREATE OR REPLACE FUNCTION prevent_audit_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF (
      OLD.id = NEW.id AND
      OLD.organization_id = NEW.organization_id AND
      OLD.request_id IS NOT DISTINCT FROM NEW.request_id AND
      OLD.assignment_id IS NOT DISTINCT FROM NEW.assignment_id AND
      OLD.sla_record_id IS NOT DISTINCT FROM NEW.sla_record_id AND
      OLD.actor_user_id IS NOT DISTINCT FROM NEW.actor_user_id AND
      OLD.actor_type = NEW.actor_type AND
      OLD.event_type = NEW.event_type AND
      OLD.occurred_at = NEW.occurred_at AND
      OLD.previous_state IS NOT DISTINCT FROM NEW.previous_state AND
      OLD.new_state IS NOT DISTINCT FROM NEW.new_state AND
      OLD.metadata = NEW.metadata AND
      OLD.correlation_id IS NOT DISTINCT FROM NEW.correlation_id AND
      OLD.created_at = NEW.created_at
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'audit_events are append-only and payload is immutable' USING ERRCODE = '55006';
END;
$$;

-- Expand audit_event_type_allowed check constraint to include 'AUDIT_LOG_DELETED' and 'AUDIT_TRAIL_PURGED'
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
    'REMOTE_SESSIONS_REVOKED',
    'AUDIT_LOG_DELETED',
    'AUDIT_TRAIL_PURGED'
  )
);
