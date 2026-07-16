-- supabase-migration-affiliate.sql
--
-- Hệ thống affiliate 1 tầng cho landing page: đối tác + click + hoa hồng.
-- Tiền điều kiện: đã có bảng `leads` (từ /biz-setup-sepay-payment chọn Supabase).
--
-- Áp dụng:  npm run db:push   (nếu có Supabase CLI)
--   hoặc:   dán toàn bộ file này vào Supabase Dashboard → SQL Editor → Run.
--
-- Idempotent: chạy lại an toàn (IF NOT EXISTS guards).

-- =============================================================================
-- 1. AFFILIATES — đối tác / cộng tác viên
-- =============================================================================

CREATE TABLE IF NOT EXISTS affiliates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  email            TEXT NOT NULL UNIQUE,                 -- định danh đăng nhập portal
  phone            TEXT,
  aff_code         TEXT NOT NULL UNIQUE,                 -- mã công khai trên link ?aff=, vd "LINH7K2"
  tier             TEXT NOT NULL DEFAULT 'pro'
                   CHECK (tier IN ('pro', 'elite')),
  commission_rate  NUMERIC(5,2) NOT NULL DEFAULT 30,     -- % hoa hồng; mặc định = rate của tier, chỉnh được
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'paused')),
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS affiliates_aff_code_idx ON affiliates(aff_code);
CREATE INDEX IF NOT EXISTS affiliates_email_idx    ON affiliates(lower(email));

-- =============================================================================
-- 2. AFFILIATE_CLICKS — log click link aff (nhẹ, để portal hiện "lượt click")
-- =============================================================================

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  aff_code    TEXT NOT NULL,                             -- KHÔNG FK: mã có thể sai/typo, vẫn ghi để soi
  path        TEXT,                                      -- trang khách bấm link, vd "/" hoặc "/ai-agent-summit"
  referrer    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS affiliate_clicks_code_idx    ON affiliate_clicks(aff_code);
CREATE INDEX IF NOT EXISTS affiliate_clicks_created_idx ON affiliate_clicks(created_at DESC);

-- =============================================================================
-- 3. AFFILIATE_COMMISSIONS — sổ sách hoa hồng (1 đơn paid = 1 row)
-- =============================================================================
-- KHÁC `leads`: bảng này KHÔNG có TTL — là bản ghi tài chính, giữ vĩnh viễn.
-- Các cột customer_name/ticket/order_amount là SNAPSHOT — sao chép lúc tạo
-- để hoa hồng vẫn đọc được sau khi lead bị pg_cron xoá (TTL 90 ngày).

CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id       UUID NOT NULL REFERENCES affiliates(id) ON DELETE CASCADE,
  aff_code           TEXT NOT NULL,
  order_id           TEXT NOT NULL UNIQUE,               -- UNIQUE → webhook retry không tạo hoa hồng trùng
  customer_name      TEXT,
  ticket             TEXT,
  order_amount       BIGINT NOT NULL,                    -- VND, snapshot giá trị đơn
  commission_rate    NUMERIC(5,2) NOT NULL,              -- % snapshot lúc bán
  commission_amount  BIGINT NOT NULL,                    -- VND = round(order_amount * rate / 100)
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at        TIMESTAMPTZ,
  paid_at            TIMESTAMPTZ,
  payout_note        TEXT                                -- vd "CK Vietcombank 01/06"
);

CREATE INDEX IF NOT EXISTS affiliate_commissions_affiliate_idx ON affiliate_commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS affiliate_commissions_status_idx    ON affiliate_commissions(status);
CREATE INDEX IF NOT EXISTS affiliate_commissions_created_idx   ON affiliate_commissions(created_at DESC);

-- =============================================================================
-- 4. ALTER LEADS — gắn cột aff_code để biết đơn thuộc đối tác nào
-- =============================================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS aff_code TEXT;
CREATE INDEX IF NOT EXISTS leads_aff_code_idx ON leads(aff_code);

-- =============================================================================
-- 5. ROW-LEVEL SECURITY — deny anon/auth; chỉ service_role (backend) bypass
-- =============================================================================

ALTER TABLE affiliates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_clicks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;

-- Không tạo policy nào → default DENY ALL từ anon/auth.
-- Mọi truy cập đi qua API route dùng service_role key.

-- =============================================================================
-- 6. CLEANUP CLICKS CŨ — gộp vào pg_cron job có sẵn nếu project đã dùng pg_cron
-- =============================================================================
-- affiliate_clicks chỉ để thống kê, > 180 ngày thì bỏ. commissions KHÔNG xoá.
-- Nếu project chưa có pg_cron, bỏ qua block này — clicks cũ không gây hại lớn.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
      FROM cron.job WHERE jobname = 'cleanup-affiliate-clicks';
    PERFORM cron.schedule(
      'cleanup-affiliate-clicks',
      '30 3 * * *',
      $job$ DELETE FROM affiliate_clicks WHERE created_at < NOW() - INTERVAL '180 days'; $job$
    );
  END IF;
END $$;

-- =============================================================================
-- 7. VERIFY
-- =============================================================================

SELECT 'affiliates'            AS table_name, COUNT(*) FROM affiliates
UNION ALL SELECT 'affiliate_clicks',      COUNT(*) FROM affiliate_clicks
UNION ALL SELECT 'affiliate_commissions', COUNT(*) FROM affiliate_commissions;

SELECT column_name
FROM information_schema.columns
WHERE table_name = 'leads' AND column_name = 'aff_code';
