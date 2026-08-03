BEGIN;

CREATE TABLE IF NOT EXISTS publisher_tenants (
  id uuid PRIMARY KEY,
  etsy_user_id text UNIQUE,
  etsy_shop_id text UNIQUE,
  etsy_shop_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS publisher_sessions (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES publisher_tenants(id) ON DELETE CASCADE,
  session_hash text NOT NULL UNIQUE,
  csrf_hash text NOT NULL,
  authenticated_at timestamptz,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS publisher_sessions_tenant_idx ON publisher_sessions (tenant_id);
CREATE INDEX IF NOT EXISTS publisher_sessions_expiry_idx ON publisher_sessions (expires_at);

CREATE TABLE IF NOT EXISTS publisher_oauth_requests (
  state_hash text PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES publisher_sessions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES publisher_tenants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('etsy', 'tiktok')),
  verifier_cipher text,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS publisher_oauth_expiry_idx ON publisher_oauth_requests (expires_at);

CREATE TABLE IF NOT EXISTS publisher_provider_tokens (
  tenant_id uuid NOT NULL REFERENCES publisher_tenants(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('etsy', 'tiktok')),
  access_cipher text NOT NULL,
  refresh_cipher text,
  token_type text NOT NULL DEFAULT 'Bearer',
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  provider_subject text,
  expires_at timestamptz,
  refresh_expires_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, provider)
);

CREATE TABLE IF NOT EXISTS publisher_listing_cache (
  tenant_id uuid NOT NULL REFERENCES publisher_tenants(id) ON DELETE CASCADE,
  listing_id text NOT NULL,
  revision text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  price_amount bigint,
  price_divisor integer,
  currency_code text,
  listing_url text,
  image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, listing_id)
);

CREATE TABLE IF NOT EXISTS publisher_creator_contexts (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES publisher_tenants(id) ON DELETE CASCADE,
  context_hash text NOT NULL,
  creator_subject text,
  creator_username text,
  creator_nickname text NOT NULL,
  privacy_options text[] NOT NULL,
  comment_disabled boolean NOT NULL,
  duet_disabled boolean NOT NULL,
  stitch_disabled boolean NOT NULL,
  max_duration_seconds integer NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS publisher_creator_tenant_idx ON publisher_creator_contexts (tenant_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS publisher_publish_jobs (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL REFERENCES publisher_tenants(id) ON DELETE CASCADE,
  listing_id text NOT NULL,
  media_sha256 text NOT NULL,
  settings_sha256 text NOT NULL,
  creator_context_hash text NOT NULL,
  media_bytes integer NOT NULL CHECK (media_bytes > 0 AND media_bytes <= 4000000),
  media_type text NOT NULL CHECK (media_type = 'video/webm'),
  duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 1 AND 600),
  state text NOT NULL,
  consented_at timestamptz NOT NULL,
  publish_id text,
  upload_url_cipher text,
  upload_nonce_hash text,
  upload_expires_at timestamptz,
  provider_status text,
  provider_post_id text,
  failure_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (tenant_id, media_sha256, settings_sha256)
);
CREATE INDEX IF NOT EXISTS publisher_jobs_tenant_idx ON publisher_publish_jobs (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS publisher_rate_limits (
  scope_key text NOT NULL,
  action text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL,
  PRIMARY KEY (scope_key, action, window_start)
);

CREATE TABLE IF NOT EXISTS publisher_audit_events (
  id bigserial PRIMARY KEY,
  tenant_id uuid REFERENCES publisher_tenants(id) ON DELETE CASCADE,
  session_id uuid,
  event_name text NOT NULL,
  outcome text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS publisher_audit_tenant_idx ON publisher_audit_events (tenant_id, created_at DESC);

COMMIT;
