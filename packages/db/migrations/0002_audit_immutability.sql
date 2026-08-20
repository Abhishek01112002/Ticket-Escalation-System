CREATE OR REPLACE FUNCTION prevent_audit_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are append-only' USING ERRCODE = '55006';
END;
$$;

DROP TRIGGER IF EXISTS audit_events_append_only ON audit_events;
CREATE TRIGGER audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();

ALTER TABLE audit_events DROP CONSTRAINT IF EXISTS audit_event_type_allowed;
ALTER TABLE audit_events ADD CONSTRAINT audit_event_type_allowed CHECK (event_type IN ('request_created','assigned','reassigned','acknowledged','work_started','resolved','sla_breached','escalation_triggered'));
