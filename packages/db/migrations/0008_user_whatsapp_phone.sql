-- Migration 0008: Add WhatsApp phone number to users table for zero-cost task notification dispatch
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_whatsapp VARCHAR(32);

-- Index for phone lookups within an organization
CREATE INDEX IF NOT EXISTS users_phone_whatsapp_idx ON users(organization_id, phone_whatsapp) WHERE phone_whatsapp IS NOT NULL;
