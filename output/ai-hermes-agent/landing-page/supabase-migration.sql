-- supabase-migration.sql
--
-- Paste toàn bộ file này vào Supabase SQL Editor → Run.
-- Tạo schema cho Sepay payment lead store + TTL cleanup qua pg_cron.
--
-- Idempotent: chạy lại an toàn (IF NOT EXISTS guards).

-- =============================================================================
-- 1. EXTENSIONS
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =============================================================================
-- 2. TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS leads (
  order_id        TEXT PRIMARY KEY,                  -- "DH000123"
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL,                     -- VN format "0901234567"
  email           TEXT NOT NULL,
  product_name    TEXT NOT NULL,
  amount          BIGINT NOT NULL,                   -- VND integer (vd 499000)
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at         TIMESTAMPTZ,
  payment_record  JSONB,                             -- Sepay payload subset
  expire_at       TIMESTAMPTZ NOT NULL               -- pg_cron job xoá rows < NOW()
);

CREATE INDEX IF NOT EXISTS leads_phone_idx     ON leads(phone);
CREATE INDEX IF NOT EXISTS leads_status_idx    ON leads(status);
CREATE INDEX IF NOT EXISTS leads_expire_at_idx ON leads(expire_at);
CREATE INDEX IF NOT EXISTS leads_amount_status_idx ON leads(amount, status) WHERE status = 'pending';

-- Secondary index — lookup lead theo SĐT
CREATE TABLE IF NOT EXISTS phone_index (
  phone       TEXT PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES leads(order_id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Singleton row chứa counter cho order ID generation
CREATE TABLE IF NOT EXISTS order_counter (
  id              SMALLINT PRIMARY KEY DEFAULT 1,
  current_value   BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT singleton_row CHECK (id = 1)
);
INSERT INTO order_counter (id, current_value) VALUES (1, 0)
  ON CONFLICT (id) DO NOTHING;

-- Webhook dedup — tránh Sepay retry duplicate processing
CREATE TABLE IF NOT EXISTS webhook_dedup (
  sepay_id        TEXT PRIMARY KEY,
  processed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expire_at       TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days'
);

CREATE INDEX IF NOT EXISTS webhook_dedup_expire_at_idx ON webhook_dedup(expire_at);

-- =============================================================================
-- 3. FUNCTIONS
-- =============================================================================

-- Atomic order ID generator. Tránh race condition khi 2 request hit cùng instant.
CREATE OR REPLACE FUNCTION next_order_id() RETURNS TEXT AS $$
DECLARE
  next_num BIGINT;
BEGIN
  UPDATE order_counter
     SET current_value = current_value + 1
   WHERE id = 1
  RETURNING current_value INTO next_num;
  RETURN 'DH' || LPAD(next_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 4. ROW-LEVEL SECURITY (RLS)
-- =============================================================================
-- RLS enabled = anon/authenticated clients DENIED.
-- service_role JWT bypass RLS → backend đọc/ghi được bình thường.
-- KHÔNG bao giờ dùng anon key từ server.

ALTER TABLE leads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_index    ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_counter  ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_dedup  ENABLE ROW LEVEL SECURITY;

-- Không tạo policy nào → default DENY ALL từ anon/auth.

-- =============================================================================
-- 5. pg_cron — daily cleanup TTL (10:00 VN = 03:00 UTC)
-- =============================================================================

-- Unschedule previous job nếu đã có (safety khi rerun migration)
DO $$
DECLARE job_id BIGINT;
BEGIN
  SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'cleanup-expired-leads';
  IF job_id IS NOT NULL THEN
    PERFORM cron.unschedule(job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-expired-leads',
  '0 3 * * *',
  $$
    DELETE FROM leads          WHERE expire_at < NOW();
    DELETE FROM webhook_dedup  WHERE expire_at < NOW();
  $$
);

-- =============================================================================
-- 6. VERIFY (chạy thử cuối cùng để confirm setup OK)
-- =============================================================================

SELECT 'leads'         AS table_name, COUNT(*) FROM leads
UNION ALL SELECT 'phone_index',     COUNT(*) FROM phone_index
UNION ALL SELECT 'order_counter',   COUNT(*) FROM order_counter
UNION ALL SELECT 'webhook_dedup',   COUNT(*) FROM webhook_dedup;

SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'cleanup-expired-leads';

SELECT next_order_id();  -- test generator. Sẽ trả "DH000001" (rồi 000002, 000003... mỗi lần gọi).
                         -- Xoá row vừa tạo trong leads (nếu có) trước khi production.
