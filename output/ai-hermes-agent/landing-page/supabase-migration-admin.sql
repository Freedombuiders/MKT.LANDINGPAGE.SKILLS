-- supabase-migration-admin.sql
--
-- Bổ sung schema cho /admin dashboard:
--   - campaigns           — header của mỗi đợt gửi email quảng cáo
--   - campaign_sends      — per-recipient status (ai nhận, status, lỗi)
--
-- Paste vào Supabase SQL Editor → Run. Idempotent, chạy lại an toàn.
-- Tiền điều kiện: đã chạy `supabase-migration.sql` của biz-setup-sepay-payment (bảng `leads`).

-- =============================================================================
-- 1. CAMPAIGNS — 1 row = 1 đợt gửi
-- =============================================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,                        -- "Khuyến mãi Tết 2026"
  subject          TEXT NOT NULL,                        -- subject line email
  body_html        TEXT NOT NULL,                        -- email body (rendered HTML)
  body_text        TEXT NOT NULL DEFAULT '',             -- plaintext fallback
  audience_kind    TEXT NOT NULL CHECK (audience_kind IN ('all', 'paid', 'pending', 'last_days')),
  audience_days    INTEGER,                              -- chỉ dùng khi audience_kind='last_days' (7/30/90)
  recipient_count  INTEGER NOT NULL DEFAULT 0,
  success_count    INTEGER NOT NULL DEFAULT 0,
  fail_count       INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS campaigns_created_at_idx ON campaigns(created_at DESC);

-- =============================================================================
-- 2. CAMPAIGN_SENDS — per-recipient log
-- =============================================================================

CREATE TABLE IF NOT EXISTS campaign_sends (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_order_id TEXT,                                    -- nullable, fk tới leads (không cascade vì lead có thể đã hết TTL)
  email         TEXT NOT NULL,
  name          TEXT,
  status        TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  error         TEXT,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS campaign_sends_campaign_idx ON campaign_sends(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_sends_email_idx    ON campaign_sends(email);

-- =============================================================================
-- 3. RLS — deny all from anon/auth; service_role bypass
-- =============================================================================

ALTER TABLE campaigns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_sends  ENABLE ROW LEVEL SECURITY;

-- Không tạo policy → default DENY ALL cho anon/auth. Backend dùng service_role.

-- =============================================================================
-- 4. VERIFY
-- =============================================================================

SELECT 'campaigns'       AS table_name, COUNT(*) FROM campaigns
UNION ALL SELECT 'campaign_sends', COUNT(*) FROM campaign_sends;
