# Migrations — Hệ thống License Revit Add-in (Supabase)

Lớp database (Postgres) cho hệ thống license subscription 3 bộ môn (ARC / STR / MEP).
Toàn bộ schema theo `so-do-thuat-toan-revit-license-supabase.md` (mục 3, 10.1, 11.1) và
`revit-license-system-plan/01-database-schema.md`.

## Yêu cầu

- Chạy trên một **Supabase project MỚI** (chưa có schema nghiệp vụ nào trước đó).
- Region: **Singapore** (đặt cùng region với Vercel để giảm latency).
- Tier: **Pro** khuyến nghị — telemetry (`usage_events`) có thể vài GB, vượt giới hạn Free 500MB.
  Free vẫn chạy được để dev/test, nhưng prune `usage_events` sớm hơn nếu dùng Free.

## Thứ tự áp dụng (BẮT BUỘC theo số)

| File | Nội dung |
|---|---|
| `0001_core.sql`          | extensions (pgcrypto, pg_cron, pg_net) · profiles + trigger `auth.users` · products · plans · plan_products |
| `0002_subscriptions.sql` | subscriptions · device_activations · trials |
| `0003_orders.sql`        | orders · payments · revoked_devices · order_counter + `next_order_id()` |
| `0004_telemetry.sql`     | usage_events + index · mv_tool_daily (materialized view) · check_logs |
| `0005_email.sql`         | email_campaigns · email_logs · email_unsubscribes |
| `0006_registry.sql`      | command_registry (+ seed mẫu) · admin_users |
| `0007_seed.sql`          | seed products + plans (giá VND) + plan_products |
| `0008_functions.sql`     | `get_active_disciplines(uid)` · `is_admin(email)` |
| `0009_rls.sql`           | bật RLS mọi bảng + policy (deny-by-default) |
| `0010_cron.sql`          | pg_cron: daily_expire / daily_rollup / daily_cleanup (+ template expiry_mailer comment) |

Mỗi file self-contained, idempotent ở mức hợp lý (`create table if not exists`,
`on conflict do nothing/update`, `drop policy if exists` trước `create policy`,
`cron.unschedule` trước `cron.schedule`).

## Cách áp dụng

### Cách A — Supabase SQL Editor (thủ công)
Mở **Dashboard → SQL Editor**, dán nội dung từng file theo đúng thứ tự `0001` → `0010`,
chạy lần lượt. Đợi mỗi file xong (không lỗi) rồi mới chạy file kế.

### Cách B — `apply_migration` (Supabase MCP)
Gọi `apply_migration` cho từng file, đặt `name` = tên file (vd `0001_core`).
Ưu tiên `apply_migration` hơn `execute_sql` cho thay đổi schema.

### Sau khi xong
- Chạy `list_tables` → phải thấy đủ 17 bảng + materialized view `mv_tool_daily`.
- Chạy `get_advisors` (security + performance) → không còn cảnh báo "RLS disabled".
- Kiểm tra `select * from cron.job;` → thấy `daily_expire`, `daily_rollup`, `daily_cleanup`.

## Bước thủ công còn lại

### 1. Cron HTTP `expiry_mailer` (trong `0010_cron.sql`)
Block này đang **comment**. Sau khi deploy route Next.js `app/api/cron/expiry-mailer`:
1. Thay `<YOUR_DOMAIN>` bằng domain production.
2. Thay `<CRON_SECRET>` bằng giá trị trùng env `CRON_SECRET` của route.
3. Bỏ comment, chạy lại đoạn `cron.schedule('expiry_mailer', ...)`.

Debug HTTP async: `select * from net._http_response order by created desc limit 20;`

### 2. Admin allowlist
Bảng `admin_users` rỗng. Thêm email super admin đầu tiên (service role / SQL Editor):
```sql
insert into public.admin_users (email, is_super) values ('ban@domain.com', true);
```

### 3. Auth email (nhóm A)
Confirm signup + reset password do Supabase Auth tự gửi — cấu hình
**Dashboard → Auth → Email Templates** (Custom SMTP + template tiếng Việt). Không phải code.

## Ghi chú vận hành

- `output/` của repo là gitignored — đây là artifact sinh ra, không commit lên repo skills.
- Truy cập DB từ Next.js/Vercel qua `@supabase/supabase-js` (PostgREST). Nếu cần SQL trực
  tiếp, dùng pooler port **6543** (Supavisor transaction mode), không dùng 5432.
- `service_role` bypass RLS → các bảng "service role only" (order_counter, revoked_devices,
  check_logs, email_*, admin_users) chỉ bật RLS, không có policy client → client anon/authenticated
  bị chặn hoàn toàn, API server (service role) vẫn ghi/đọc được.
