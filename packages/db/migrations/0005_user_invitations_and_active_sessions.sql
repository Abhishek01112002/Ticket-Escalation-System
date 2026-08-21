-- 0005_user_invitations_and_active_sessions.sql
-- User invitations table for secure 7-day onboarding links

CREATE TABLE IF NOT EXISTS user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL,
  role_id uuid NOT NULL REFERENCES roles(id),
  token_hash text NOT NULL UNIQUE,
  invited_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_token_hash ON user_invitations(token_hash) WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_invitations_org_email ON user_invitations(organization_id, email);

-- Enrich sessions table with device and IP metadata for Active Sessions & Device Management
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address text;
