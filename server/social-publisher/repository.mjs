import { neon } from '@neondatabase/serverless';

export class PublisherRepository {
  constructor(sql) {
    this.sql = sql;
  }

  static fromConnectionString(connectionString) {
    return new PublisherRepository(neon(connectionString));
  }

  async health() {
    const rows = await this.sql.query('SELECT 1 AS ok', []);
    return Number(rows[0]?.ok) === 1;
  }

  async createSession({ tenantId, sessionId, sessionHash, csrfHash, expiresAt }) {
    const rows = await this.sql.query(`
      WITH tenant AS (
        INSERT INTO publisher_tenants (id) VALUES ($1::uuid)
        RETURNING id
      )
      INSERT INTO publisher_sessions (id, tenant_id, session_hash, csrf_hash, expires_at)
      SELECT $2::uuid, id, $3, $4, $5::timestamptz FROM tenant
      RETURNING id, tenant_id, expires_at
    `, [tenantId, sessionId, sessionHash, csrfHash, expiresAt]);
    return rows[0] ?? null;
  }

  async getSession(sessionHash) {
    const rows = await this.sql.query(`
      SELECT s.id, s.tenant_id, s.csrf_hash, s.authenticated_at, s.expires_at,
             t.etsy_user_id, t.etsy_shop_id, t.etsy_shop_name,
             EXISTS (SELECT 1 FROM publisher_provider_tokens p WHERE p.tenant_id = s.tenant_id AND p.provider = 'etsy') AS etsy_connected,
             EXISTS (SELECT 1 FROM publisher_provider_tokens p WHERE p.tenant_id = s.tenant_id AND p.provider = 'tiktok') AS tiktok_connected
      FROM publisher_sessions s
      JOIN publisher_tenants t ON t.id = s.tenant_id
      WHERE s.session_hash = $1 AND s.expires_at > now()
      LIMIT 1
    `, [sessionHash]);
    return rows[0] ?? null;
  }

  async rotateCsrf(sessionId, csrfHash) {
    const rows = await this.sql.query(`
      UPDATE publisher_sessions
      SET csrf_hash = $2, last_seen_at = now()
      WHERE id = $1::uuid AND expires_at > now()
      RETURNING id
    `, [sessionId, csrfHash]);
    return rows.length === 1;
  }

  async saveOAuthRequest(input) {
    await this.sql.query(`
      INSERT INTO publisher_oauth_requests
        (state_hash, session_id, tenant_id, provider, verifier_cipher, expires_at)
      VALUES ($1, $2::uuid, $3::uuid, $4, $5, $6::timestamptz)
    `, [input.stateHash, input.sessionId, input.tenantId, input.provider, input.verifierCipher ?? null, input.expiresAt]);
  }

  async consumeOAuthRequest(stateHash, provider, sessionId, tenantId) {
    const rows = await this.sql.query(`
      UPDATE publisher_oauth_requests
      SET consumed_at = now()
      WHERE state_hash = $1 AND provider = $2
        AND session_id = $3::uuid AND tenant_id = $4::uuid
        AND consumed_at IS NULL AND expires_at > now()
      RETURNING state_hash, session_id, tenant_id, provider, verifier_cipher
    `, [stateHash, provider, sessionId, tenantId]);
    return rows[0] ?? null;
  }

  async bindEtsyTenant({ tenantId, sessionId, userId, shopId, shopName }) {
    const rows = await this.sql.query(`
      WITH existing AS (
        SELECT id FROM publisher_tenants
        WHERE etsy_user_id = $3 OR etsy_shop_id = $4
        ORDER BY created_at ASC LIMIT 1
      ), chosen AS (
        SELECT id FROM existing
        UNION ALL SELECT $1::uuid WHERE NOT EXISTS (SELECT 1 FROM existing)
        LIMIT 1
      ), bound AS (
        UPDATE publisher_tenants
        SET etsy_user_id = $3, etsy_shop_id = $4, etsy_shop_name = $5, updated_at = now()
        WHERE id = (SELECT id FROM chosen)
        RETURNING id
      ), moved AS (
        UPDATE publisher_sessions
        SET tenant_id = (SELECT id FROM bound), authenticated_at = now(), last_seen_at = now()
        WHERE id = $2::uuid
        RETURNING tenant_id
      ), removed AS (
        DELETE FROM publisher_tenants
        WHERE id = $1::uuid AND id <> (SELECT tenant_id FROM moved)
        RETURNING id
      )
      SELECT tenant_id FROM moved
    `, [tenantId, sessionId, userId, shopId, shopName]);
    return rows[0]?.tenant_id ?? null;
  }

  async upsertProviderToken(input) {
    await this.sql.query(`
      INSERT INTO publisher_provider_tokens
        (tenant_id, provider, access_cipher, refresh_cipher, token_type, scopes, provider_subject, expires_at, refresh_expires_at)
      VALUES ($1::uuid, $2, $3, $4, $5, $6::text[], $7, $8::timestamptz, $9::timestamptz)
      ON CONFLICT (tenant_id, provider) DO UPDATE SET
        access_cipher = EXCLUDED.access_cipher,
        refresh_cipher = EXCLUDED.refresh_cipher,
        token_type = EXCLUDED.token_type,
        scopes = EXCLUDED.scopes,
        provider_subject = EXCLUDED.provider_subject,
        expires_at = EXCLUDED.expires_at,
        refresh_expires_at = EXCLUDED.refresh_expires_at,
        updated_at = now()
    `, [input.tenantId, input.provider, input.accessCipher, input.refreshCipher ?? null, input.tokenType ?? 'Bearer', input.scopes ?? [], input.providerSubject ?? null, input.expiresAt ?? null, input.refreshExpiresAt ?? null]);
  }

  async getProviderToken(tenantId, provider) {
    const rows = await this.sql.query(`
      SELECT tenant_id, provider, access_cipher, refresh_cipher, token_type, scopes,
             provider_subject, expires_at, refresh_expires_at, updated_at
      FROM publisher_provider_tokens
      WHERE tenant_id = $1::uuid AND provider = $2
      LIMIT 1
    `, [tenantId, provider]);
    return rows[0] ?? null;
  }

  async deleteProviderToken(tenantId, provider) {
    await this.sql.query('DELETE FROM publisher_provider_tokens WHERE tenant_id = $1::uuid AND provider = $2', [tenantId, provider]);
  }

  async upsertListings(tenantId, listings, expiresAt) {
    for (const listing of listings) {
      await this.sql.query(`
        INSERT INTO publisher_listing_cache
          (tenant_id, listing_id, revision, title, description, price_amount, price_divisor, currency_code, listing_url, image_urls, fetched_at, expires_at)
        VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, now(), $11::timestamptz)
        ON CONFLICT (tenant_id, listing_id) DO UPDATE SET
          revision = EXCLUDED.revision, title = EXCLUDED.title, description = EXCLUDED.description,
          price_amount = EXCLUDED.price_amount, price_divisor = EXCLUDED.price_divisor,
          currency_code = EXCLUDED.currency_code, listing_url = EXCLUDED.listing_url,
          image_urls = EXCLUDED.image_urls, fetched_at = now(), expires_at = EXCLUDED.expires_at
      `, [tenantId, listing.listingId, listing.revision, listing.title, listing.description, listing.priceAmount, listing.priceDivisor, listing.currencyCode, listing.listingUrl, JSON.stringify(listing.imageUrls), expiresAt]);
    }
  }

  async listCachedListings(tenantId) {
    return this.sql.query(`
      SELECT listing_id, revision, title, description, price_amount, price_divisor,
             currency_code, listing_url, image_urls, fetched_at, expires_at
      FROM publisher_listing_cache
      WHERE tenant_id = $1::uuid AND expires_at > now()
      ORDER BY fetched_at DESC, listing_id DESC
      LIMIT 12
    `, [tenantId]);
  }

  async getListing(tenantId, listingId) {
    const rows = await this.sql.query(`
      SELECT listing_id, revision, title, description, price_amount, price_divisor,
             currency_code, listing_url, image_urls, expires_at
      FROM publisher_listing_cache
      WHERE tenant_id = $1::uuid AND listing_id = $2 AND expires_at > now()
      LIMIT 1
    `, [tenantId, listingId]);
    return rows[0] ?? null;
  }

  async saveCreatorContext(input) {
    await this.sql.query(`
      INSERT INTO publisher_creator_contexts
        (id, tenant_id, context_hash, creator_subject, creator_username, creator_nickname,
         privacy_options, comment_disabled, duet_disabled, stitch_disabled,
         max_duration_seconds, expires_at)
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::text[], $8, $9, $10, $11, $12::timestamptz)
    `, [input.id, input.tenantId, input.contextHash, input.creatorSubject ?? null, input.creatorUsername ?? null, input.creatorNickname, input.privacyOptions, input.commentDisabled, input.duetDisabled, input.stitchDisabled, input.maxDurationSeconds, input.expiresAt]);
  }

  async getCreatorContext(tenantId, id) {
    const rows = await this.sql.query(`
      SELECT id, tenant_id, context_hash, creator_subject, creator_username, creator_nickname,
             privacy_options, comment_disabled, duet_disabled, stitch_disabled,
             max_duration_seconds, fetched_at, expires_at
      FROM publisher_creator_contexts
      WHERE tenant_id = $1::uuid AND id = $2::uuid AND expires_at > now()
      LIMIT 1
    `, [tenantId, id]);
    return rows[0] ?? null;
  }

  async findPublishJob(tenantId, mediaSha256, settingsSha256) {
    const rows = await this.sql.query(`
      SELECT * FROM publisher_publish_jobs
      WHERE tenant_id = $1::uuid AND media_sha256 = $2 AND settings_sha256 = $3
      LIMIT 1
    `, [tenantId, mediaSha256, settingsSha256]);
    return rows[0] ?? null;
  }

  async createPublishJob(input) {
    const rows = await this.sql.query(`
      INSERT INTO publisher_publish_jobs
        (id, tenant_id, listing_id, media_sha256, settings_sha256, creator_context_hash,
         media_bytes, media_type, duration_seconds, state, consented_at, publish_id,
         upload_url_cipher, upload_nonce_hash, upload_expires_at, provider_status)
      VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz,
              $12, $13, $14, $15::timestamptz, $16)
      ON CONFLICT (tenant_id, media_sha256, settings_sha256) DO NOTHING
      RETURNING *
    `, [input.id, input.tenantId, input.listingId, input.mediaSha256, input.settingsSha256, input.creatorContextHash, input.mediaBytes, input.mediaType, input.durationSeconds, input.state, input.consentedAt, input.publishId, input.uploadUrlCipher, input.uploadNonceHash, input.uploadExpiresAt, input.providerStatus]);
    return rows[0] ?? null;
  }

  async markPublishInitialized(tenantId, jobId, input) {
    const rows = await this.sql.query(`
      UPDATE publisher_publish_jobs SET
        state = 'AWAITING_UPLOAD', publish_id = $3, upload_url_cipher = $4,
        upload_nonce_hash = $5, upload_expires_at = $6::timestamptz,
        provider_status = 'AWAITING_UPLOAD', updated_at = now()
      WHERE tenant_id = $1::uuid AND id = $2::uuid AND state = 'INITIALIZING'
      RETURNING *
    `, [tenantId, jobId, input.publishId, input.uploadUrlCipher, input.uploadNonceHash, input.uploadExpiresAt]);
    return rows[0] ?? null;
  }

  async getPublishJob(tenantId, jobId) {
    const rows = await this.sql.query('SELECT * FROM publisher_publish_jobs WHERE tenant_id = $1::uuid AND id = $2::uuid LIMIT 1', [tenantId, jobId]);
    return rows[0] ?? null;
  }

  async rotateUploadNonce(tenantId, jobId, nonceHash) {
    const rows = await this.sql.query(`
      UPDATE publisher_publish_jobs SET upload_nonce_hash = $3, updated_at = now()
      WHERE tenant_id = $1::uuid AND id = $2::uuid AND state = 'AWAITING_UPLOAD' AND upload_expires_at > now()
      RETURNING *
    `, [tenantId, jobId, nonceHash]);
    return rows[0] ?? null;
  }

  async claimUpload(tenantId, jobId, nonceHash) {
    const rows = await this.sql.query(`
      UPDATE publisher_publish_jobs
      SET state = 'UPLOADING', upload_nonce_hash = NULL, updated_at = now()
      WHERE tenant_id = $1::uuid AND id = $2::uuid AND state = 'AWAITING_UPLOAD'
        AND upload_nonce_hash = $3 AND upload_expires_at > now()
      RETURNING *
    `, [tenantId, jobId, nonceHash]);
    return rows[0] ?? null;
  }

  async updatePublishJob(tenantId, jobId, patch) {
    const rows = await this.sql.query(`
      UPDATE publisher_publish_jobs SET
        state = COALESCE($3, state),
        provider_status = COALESCE($4, provider_status),
        provider_post_id = COALESCE($5, provider_post_id),
        failure_code = $6,
        upload_url_cipher = CASE WHEN $7 THEN NULL ELSE upload_url_cipher END,
        completed_at = CASE WHEN $8 THEN now() ELSE completed_at END,
        updated_at = now()
      WHERE tenant_id = $1::uuid AND id = $2::uuid
      RETURNING *
    `, [tenantId, jobId, patch.state ?? null, patch.providerStatus ?? null, patch.providerPostId ?? null, patch.failureCode ?? null, patch.clearUpload === true, patch.complete === true]);
    return rows[0] ?? null;
  }

  async rateLimit(scopeKey, action, windowStart, maximum) {
    const rows = await this.sql.query(`
      INSERT INTO publisher_rate_limits (scope_key, action, window_start, request_count)
      VALUES ($1, $2, $3::timestamptz, 1)
      ON CONFLICT (scope_key, action, window_start) DO UPDATE
      SET request_count = publisher_rate_limits.request_count + 1
      RETURNING request_count
    `, [scopeKey, action, windowStart]);
    return Number(rows[0]?.request_count ?? maximum + 1) <= maximum;
  }

  async audit(input) {
    await this.sql.query(`
      INSERT INTO publisher_audit_events (tenant_id, session_id, event_name, outcome, details)
      VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb)
    `, [input.tenantId ?? null, input.sessionId ?? null, input.eventName, input.outcome, JSON.stringify(input.details ?? {})]);
  }

  async deleteTenant(tenantId) {
    await this.sql.query('DELETE FROM publisher_tenants WHERE id = $1::uuid', [tenantId]);
  }

  async cleanup() {
    await this.sql.transaction((txn) => [
      txn`DELETE FROM publisher_oauth_requests WHERE expires_at < now() - interval '1 day'`,
      txn`DELETE FROM publisher_sessions WHERE expires_at < now()`,
      txn`DELETE FROM publisher_listing_cache WHERE expires_at < now()`,
      txn`DELETE FROM publisher_creator_contexts WHERE expires_at < now()`,
      txn`DELETE FROM publisher_rate_limits WHERE window_start < now() - interval '1 day'`,
      txn`DELETE FROM publisher_publish_jobs WHERE completed_at < now() - interval '90 days'`,
      txn`DELETE FROM publisher_audit_events WHERE created_at < now() - interval '90 days'`,
      txn`DELETE FROM publisher_tenants AS tenant
          WHERE tenant.updated_at < now() - interval '31 days'
            AND NOT EXISTS (
              SELECT 1 FROM publisher_sessions AS session
              WHERE session.tenant_id = tenant.id AND session.expires_at > now()
            )`,
    ]);
  }
}
