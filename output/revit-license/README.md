# Hệ thống License Revit Add-in (ARC · STR · MEP)

Sản phẩm: Add-in Revit 3 bộ môn — Kiến trúc (ARC), Kết cấu (STR), Điện nước/MEP (MEP).
Mô hình: subscription theo bộ môn hoặc combo, trial 30 ngày tự động, kiểm tra quyền mỗi command (verify Ed25519 offline), telemetry usage/lỗi, email nghiệp vụ + campaign.

Tài liệu thiết kế gốc: [`../../so-do-thuat-toan-revit-license-supabase.md`](../../so-do-thuat-toan-revit-license-supabase.md) · Plan từng module: [`../../revit-license-system-plan/`](../../revit-license-system-plan/)

## Cấu trúc

```
revit-license/
  web/                 Next.js 15 (App Router) — web bán hàng + portal + admin + TẤT CẢ API routes (deploy Vercel)
    app/               page.tsx (landing), login/register/reset-password, dashboard, buy, admin/*
    app/api/           license (activate/refresh/issue-trial/check-entitlement/devices/public-key),
                       payment (create-order/sepay-webhook), telemetry, email (send-campaign/unsubscribe),
                       cron/expiry-mailer, admin/*
    lib/               supabase(-admin), auth-user, http, signing (Ed25519), renew, mailer, telegram, format
    supabase/migrations/  0001..0010 SQL (schema + RLS + seed + functions + pg_cron)
    templates/email/   purchase-confirm / expiry-reminder / campaign-base (HTML VN)
    scripts/gen-keys.mjs  sinh cặp khóa Ed25519
  revit-addin/         C#/.NET 4.8 add-in (Auth WPF + LicenseClient + Ed25519 verify + Telemetry) — SOURCE ONLY
```

## Trạng thái build

- `web/`: `next build` PASS (31 routes). Đã bump Next.js lên bản đã vá CVE.
- `revit-addin/`: source-only, **chưa compile** (cần Windows + Visual Studio + Revit API). Logic token-parse / Ed25519 verify / CanRun / telemetry queue đã hoàn chỉnh; chỉ còn placeholder môi trường (xem `revit-addin/README.md`).

## Chạy web local

```bash
cd web
cp .env.example .env.local   # điền giá trị thật
npm install
npm run dev                  # http://localhost:3000
npm run build                # cổng correctness
```

## Thứ tự triển khai (tóm tắt)

1. **Tạo Supabase project mới** (region Singapore, khuyến nghị Pro cho telemetry). Apply lần lượt `web/supabase/migrations/0001..0010` (xem `web/supabase/migrations/README.md`). Đừng dùng chung project landing-page hiện có.
2. **Sinh khóa Ed25519:** `node web/scripts/gen-keys.mjs` → set `ED25519_PRIVATE_KEY` + `ED25519_PUBLIC_KEY_ID` vào Vercel env; nhúng public key vào `revit-addin/Config.cs` + `revit-addin/Resources/public-key.pem`.
3. **Điền env** (`web/.env.example` là danh sách đầy đủ): Supabase, Sepay, email (Resend/SMTP), `CRON_SECRET`, `ADMIN_PASSWORD`.
4. **Deploy Vercel** (region = region Supabase). Cập nhật webhook URL Sepay → `/api/sepay-webhook`.
5. **Supabase Cron:** bật job HTTP gọi `/api/cron/expiry-mailer` kèm `Authorization: Bearer <CRON_SECRET>` (template comment sẵn trong `0010_cron.sql`).
6. **Custom SMTP cho Supabase Auth** (email xác nhận đăng ký + reset mật khẩu) + sửa template tiếng Việt trong Supabase Dashboard.
7. **Add-in:** điền `Config.cs` (API_BASE = domain production, Supabase URL/anon key, public key), build trên Windows, cài `.addin`.

## Hợp đồng kỹ thuật quan trọng

- **Entitlement token:** compact JWT EdDSA (Ed25519). Payload `{sub, device, disciplines[], plan, iat, exp(24h), grace_until(7d), jti}`. Add-in verify offline bằng public key theo `kid`.
- **order_id:** `DH` + 6 số (`DH000123`). Webhook idempotent theo order_id, luôn trả 200.
- **Gia hạn cộng dồn:** `base = max(now, current_period_end)` → `+1 tháng/năm`.
- **Quyền:** `subscriptions.status='active' AND current_period_end > now()`.
- **Admin:** hiện dùng password gate (`x-admin-pass`, mặc định `123456`). Có thể nâng cấp sang Google allowlist bằng skill `/biz-admin-google-auth` sau.

## Bảo mật

Service role key + Ed25519 private + Sepay/CRON secret CHỈ ở server route (Vercel env), không bao giờ ở client bundle hay add-in. RLS deny-by-default trên mọi bảng. Add-in cache token + auth mã hoá DPAPI. Chi tiết: [`../../revit-license-system-plan/10-security-hardening.md`](../../revit-license-system-plan/10-security-hardening.md).
