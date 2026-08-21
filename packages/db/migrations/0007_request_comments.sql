-- Migration 0007: Internal comment threads per ticket
-- Internal-only: never exposed to clients or public tracker API.
-- PM and Specialists can read & write. Client portal has zero access.

CREATE TABLE IF NOT EXISTS request_comments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_id      uuid        NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  author_user_id  uuid        NOT NULL REFERENCES users(id),
  body            text        NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 4000),
  is_internal     boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup: all comments for a given ticket in chronological order
CREATE INDEX IF NOT EXISTS comments_request_created_idx
  ON request_comments (request_id, created_at ASC);

-- Fast org-level audit of all comments by recency
CREATE INDEX IF NOT EXISTS comments_org_created_idx
  ON request_comments (organization_id, created_at DESC);

-- Fast lookup of all comments by a specific author
CREATE INDEX IF NOT EXISTS comments_author_idx
  ON request_comments (author_user_id, created_at DESC);
