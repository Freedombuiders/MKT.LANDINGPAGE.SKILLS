

-- ============================================================
-- 0001_core.sql
-- ============================================================

-- 0001_core.sql
-- Lop nen: extensions, profiles (+ trigger tu auth.users), products, plans, plan_products.
-- Chay dau tien. An toan chay lai (idempotent).

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
-- pgcrypto: gen_random_uuid()
-- pg_cron: lich dinh ky (module 09)
-- pg_net: goi HTTP tu trong DB (expiry_mailer)
create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- profiles  (mo rong auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  phone      text,
  company    text,
  created_at timestamptz not null default now()
);

-- Trigger: moi khi co user moi trong auth.users -> tao 1 dong profiles,
-- keo full_name / phone tu raw_user_meta_data (do client truyen khi signup).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- products  (bo mon: ARC / STR / MEP)
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  code      text primary key,        -- 'ARC' | 'STR' | 'MEP'
  name      text not null,           -- 'Kien truc' ...
  is_active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- plans  (goi ban: don le + combo)
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id        uuid primary key default gen_random_uuid(),
  code      text unique not null,    -- 'ARC_M','ARC_Y','COMBO_Y'...
  name      text not null,
  period    text not null check (period in ('month','year')),
  price_vnd integer not null check (price_vnd >= 0),
  is_combo  boolean not null default false,
  is_active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- plan_products  (goi nay phu nhung bo mon nao)
-- ---------------------------------------------------------------------------
create table if not exists public.plan_products (
  plan_id      uuid not null references public.plans(id) on delete cascade,
  product_code text not null references public.products(code) on delete cascade,
  primary key (plan_id, product_code)
);

create index if not exists idx_plan_products_product on public.plan_products(product_code);


-- ============================================================
-- 0002_subscriptions.sql
-- ============================================================

-- 0002_subscriptions.sql
-- subscriptions, device_activations, trials.

-- ---------------------------------------------------------------------------
-- subscriptions
-- 1 dong cho moi (user, product_code). Combo = 3 dong.
-- Quyen = status='active' AND current_period_end > now().
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  product_code       text not null references public.products(code),
  source             text not null default 'paid' check (source in ('trial','paid')),
  status             text not null default 'active' check (status in ('active','expired','canceled')),
  current_period_end timestamptz not null,
  max_devices        integer not null default 2,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, product_code)
);

create index if not exists idx_subscriptions_user      on public.subscriptions(user_id);
create index if not exists idx_subscriptions_status    on public.subscriptions(status);
create index if not exists idx_subscriptions_period_end on public.subscriptions(current_period_end);

-- ---------------------------------------------------------------------------
-- device_activations  (gioi han seat)
-- ---------------------------------------------------------------------------
create table if not exists public.device_activations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  device_id    text not null,          -- fingerprint may
  device_name  text,                   -- ten may / Revit version
  last_seen_at timestamptz not null default now(),
  status       text not null default 'active' check (status in ('active','revoked')),
  created_at   timestamptz not null default now(),
  unique (user_id, device_id)
);

create index if not exists idx_device_activations_user on public.device_activations(user_id);

-- ---------------------------------------------------------------------------
-- trials  (chong lam dung: khoa theo user_id LAN device_fingerprint)
-- ---------------------------------------------------------------------------
create table if not exists public.trials (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null unique references auth.users(id) on delete cascade,
  device_fingerprint text,
  granted_at         timestamptz not null default now(),
  expires_at         timestamptz not null
);

create index if not exists idx_trials_fingerprint on public.trials(device_fingerprint);


-- ============================================================
-- 0003_orders.sql
-- ============================================================

-- 0003_orders.sql
-- orders, payments, revoked_devices, order_counter (sinh order id 'DH######').

-- ---------------------------------------------------------------------------
-- order_counter  (single-row counter, seed = 0)
-- Dung de sinh order id dang 'DH000123'. Webhook/checkout goi next_order_id().
-- ---------------------------------------------------------------------------
create table if not exists public.order_counter (
  id    integer primary key default 1 check (id = 1),
  value bigint  not null default 0
);

insert into public.order_counter (id, value)
values (1, 0)
on conflict (id) do nothing;

-- Sinh order id ke tiep: tang counter nguyen tu roi format 'DH' + 6 chu so.
create or replace function public.next_order_id()
returns text
language plpgsql
as $$
declare
  v bigint;
begin
  update public.order_counter
     set value = value + 1
   where id = 1
  returning value into v;
  return 'DH' || lpad(v::text, 6, '0');
end;
$$;

-- ---------------------------------------------------------------------------
-- orders
-- id text PK = 'DH######'. Webhook idempotent theo order_id.
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id         text primary key,        -- 'DH000123'
  user_id    uuid not null references auth.users(id) on delete cascade,
  plan_id    uuid not null references public.plans(id),
  amount_vnd integer not null check (amount_vnd >= 0),
  status     text not null default 'pending' check (status in ('pending','paid','expired')),
  created_at timestamptz not null default now(),
  paid_at    timestamptz
);

create index if not exists idx_orders_user   on public.orders(user_id);
create index if not exists idx_orders_status on public.orders(status);

-- ---------------------------------------------------------------------------
-- payments  (raw payload tu cong thanh toan)
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  order_id    text references public.orders(id) on delete set null,
  gateway     text not null,          -- 'sepay' | 'payos' ...
  raw         jsonb,
  received_at timestamptz not null default now()
);

create index if not exists idx_payments_order on public.payments(order_id);

-- ---------------------------------------------------------------------------
-- revoked_devices  (thu hoi khan: refund/chargeback)
-- ---------------------------------------------------------------------------
create table if not exists public.revoked_devices (
  device_id text primary key,
  reason    text,
  at        timestamptz not null default now()
);


-- ============================================================
-- 0004_telemetry.sql
-- ============================================================

-- 0004_telemetry.sql
-- usage_events (insert-only), mv_tool_daily (rollup), check_logs (audit).

-- ---------------------------------------------------------------------------
-- usage_events
-- Ghi moi lan chay command: success / error / denied.
-- Insert-only (RLS chi cho user ghi user_id = auth.uid(), khong update/delete).
-- ---------------------------------------------------------------------------
create table if not exists public.usage_events (
  id            bigint generated always as identity primary key,
  user_id       uuid references auth.users(id) on delete set null,
  device_id     text,
  session_id    text,                 -- 1 phien mo Revit
  command_id    text not null,        -- 'STR.ColumnRebar' ...
  product_code  text,                 -- ARC/STR/MEP
  status        text not null check (status in ('success','error','denied')),
  duration_ms   integer,
  revit_version text,                 -- '2024'
  app_version   text,                 -- version add-in
  error_code    text,                 -- null neu success
  error_message text,
  stack_trace   text,                 -- chi ghi khi error
  started_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_usage_events_command on public.usage_events(command_id, started_at);
create index if not exists idx_usage_events_user    on public.usage_events(user_id, started_at);
create index if not exists idx_usage_events_status  on public.usage_events(status);

-- ---------------------------------------------------------------------------
-- mv_tool_daily  (rollup ngay, pg_cron refresh moi dem -> dashboard nhanh)
-- Co unique index de REFRESH ... CONCURRENTLY chay duoc.
-- ---------------------------------------------------------------------------
drop materialized view if exists public.mv_tool_daily;
create materialized view public.mv_tool_daily as
select
  started_at::date                                   as day,
  command_id,
  product_code,
  count(*)::int                                      as runs,
  count(*) filter (where status = 'success')::int    as success,
  count(*) filter (where status = 'error')::int      as errors,
  count(*) filter (where status = 'denied')::int     as denied,
  count(distinct user_id)::int                       as unique_users
from public.usage_events
where started_at is not null
group by started_at::date, command_id, product_code
with no data;

-- Unique index bat buoc cho REFRESH MATERIALIZED VIEW CONCURRENTLY.
-- product_code co the null -> coalesce de unique on dinh.
create unique index if not exists idx_mv_tool_daily_unique
  on public.mv_tool_daily (day, command_id, coalesce(product_code, ''));

-- Nap du lieu lan dau (neu da co usage_events). An toan khi rong.
refresh materialized view public.mv_tool_daily;

-- ---------------------------------------------------------------------------
-- check_logs  (audit kiem tra quyen + phat hien gian lan)
-- ---------------------------------------------------------------------------
create table if not exists public.check_logs (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users(id) on delete set null,
  device_id  text,
  command_id text,
  result     text,                    -- 'allow' | 'deny' ...
  at         timestamptz not null default now()
);

create index if not exists idx_check_logs_user   on public.check_logs(user_id, at);
create index if not exists idx_check_logs_device on public.check_logs(device_id, at);


-- ============================================================
-- 0005_email.sql
-- ============================================================

-- 0005_email.sql
-- email_campaigns, email_logs, email_unsubscribes.

-- ---------------------------------------------------------------------------
-- email_campaigns  (chien dich marketing soan tu admin)
-- ---------------------------------------------------------------------------
create table if not exists public.email_campaigns (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  subject    text not null,
  body_html  text,
  body_kind  text not null default 'html' check (body_kind in ('text','html')),
  audience   text not null default 'all'
             check (audience in ('all','trial','paid','expired','expiring_7d')),
  status     text not null default 'draft' check (status in ('draft','sending','sent')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);

-- ---------------------------------------------------------------------------
-- email_logs  (log per-recipient moi lan gui)
-- ---------------------------------------------------------------------------
create table if not exists public.email_logs (
  id          bigint generated always as identity primary key,
  campaign_id uuid references public.email_campaigns(id) on delete set null,
  type        text not null,          -- 'purchase' | 'expiry' | 'campaign'
  to_email    text not null,
  status      text not null check (status in ('sent','failed')),
  error       text,
  sent_at     timestamptz not null default now()
);

create index if not exists idx_email_logs_campaign on public.email_logs(campaign_id);
create index if not exists idx_email_logs_to       on public.email_logs(to_email);
create index if not exists idx_email_logs_type     on public.email_logs(type, sent_at);

-- ---------------------------------------------------------------------------
-- email_unsubscribes  (chong gui marketing toi nguoi da huy)
-- ---------------------------------------------------------------------------
create table if not exists public.email_unsubscribes (
  email text primary key,
  at    timestamptz not null default now()
);


-- ============================================================
-- 0006_registry.sql
-- ============================================================

-- 0006_registry.sql
-- command_registry (command -> bo mon), admin_users (allowlist).

-- ---------------------------------------------------------------------------
-- command_registry
-- Add-in tra cuu command nao can quyen bo mon nao.
-- ---------------------------------------------------------------------------
create table if not exists public.command_registry (
  command_id   text primary key,      -- 'ARC.AutoDimension'
  product_code text not null references public.products(code),
  min_version  text
);

create index if not exists idx_command_registry_product on public.command_registry(product_code);

-- ---------------------------------------------------------------------------
-- admin_users  (allowlist quan tri vien; tai dung pattern /biz-admin-google-auth)
-- is_admin(email) doc tu bang nay.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  email      text primary key,
  is_super   boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Seed command_registry mau (NOTE: products phai ton tai truoc -> chay 0007_seed
-- co the chay TRUOC neu muon, nhung o day ta insert products toi thieu phong khi
-- 0007 chua chay). Dam bao FK product_code khong fail.
-- ---------------------------------------------------------------------------
insert into public.products (code, name, is_active) values
  ('ARC', 'Kien truc',      true),
  ('STR', 'Ket cau',        true),
  ('MEP', 'Dien nuoc MEP',  true)
on conflict (code) do nothing;

insert into public.command_registry (command_id, product_code, min_version) values
  ('ARC.WallDimension', 'ARC', '1.0.0'),
  ('ARC.AutoDimension', 'ARC', '1.0.0'),
  ('STR.ColumnRebar',   'STR', '1.0.0'),
  ('STR.BeamRebar',     'STR', '1.0.0'),
  ('MEP.PipeRoute',     'MEP', '1.0.0')
on conflict (command_id) do nothing;


-- ============================================================
-- 0007_seed.sql
-- ============================================================

-- 0007_seed.sql
-- Seed products + plans + plan_products.
-- Gia VND charm-friendly: don le 200.000d/thang, 2.000.000d/nam;
-- combo 500.000d/thang, 5.000.000d/nam.

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
insert into public.products (code, name, is_active) values
  ('ARC', 'Kien truc',      true),
  ('STR', 'Ket cau',        true),
  ('MEP', 'Dien nuoc MEP',  true)
on conflict (code) do update set name = excluded.name, is_active = excluded.is_active;

-- ---------------------------------------------------------------------------
-- plans (don le theo bo mon + combo)
-- ---------------------------------------------------------------------------
insert into public.plans (code, name, period, price_vnd, is_combo, is_active) values
  ('ARC_M', 'Kien truc - thang',  'month',  200000, false, true),
  ('ARC_Y', 'Kien truc - nam',    'year',  2000000, false, true),
  ('STR_M', 'Ket cau - thang',    'month',  200000, false, true),
  ('STR_Y', 'Ket cau - nam',      'year',  2000000, false, true),
  ('MEP_M', 'MEP - thang',        'month',  200000, false, true),
  ('MEP_Y', 'MEP - nam',          'year',  2000000, false, true),
  ('COMBO_M', 'Combo 3 bo mon - thang', 'month',  500000, true, true),
  ('COMBO_Y', 'Combo 3 bo mon - nam',   'year',  5000000, true, true)
on conflict (code) do update set
  name      = excluded.name,
  period    = excluded.period,
  price_vnd = excluded.price_vnd,
  is_combo  = excluded.is_combo,
  is_active = excluded.is_active;

-- ---------------------------------------------------------------------------
-- plan_products
-- Don le -> tro toi product cua chinh no. Combo -> ca 3 bo mon.
-- ---------------------------------------------------------------------------
insert into public.plan_products (plan_id, product_code)
select p.id, m.product_code
from (values
  ('ARC_M','ARC'),
  ('ARC_Y','ARC'),
  ('STR_M','STR'),
  ('STR_Y','STR'),
  ('MEP_M','MEP'),
  ('MEP_Y','MEP'),
  ('COMBO_M','ARC'),
  ('COMBO_M','STR'),
  ('COMBO_M','MEP'),
  ('COMBO_Y','ARC'),
  ('COMBO_Y','STR'),
  ('COMBO_Y','MEP')
) as m(plan_code, product_code)
join public.plans p on p.code = m.plan_code
on conflict (plan_id, product_code) do nothing;


-- ============================================================
-- 0008_functions.sql
-- ============================================================

-- 0008_functions.sql
-- Ham nghiep vu dung chung cho Edge/API.

-- ---------------------------------------------------------------------------
-- get_active_disciplines(uid)
-- Tra mang product_code dang active cua user (Edge 'activate' dung de ky token).
-- ---------------------------------------------------------------------------
create or replace function public.get_active_disciplines(uid uuid)
returns text[]
language sql
stable
as $$
  select coalesce(array_agg(distinct product_code), array[]::text[])
  from public.subscriptions
  where user_id = uid
    and status = 'active'
    and current_period_end > now();
$$;

-- ---------------------------------------------------------------------------
-- is_admin(p_email)
-- True neu email nam trong allowlist admin_users.
-- SECURITY DEFINER de chay bypass RLS (admin_users deny-all voi user thuong).
-- ---------------------------------------------------------------------------
create or replace function public.is_admin(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where email = p_email
  );
$$;


-- ============================================================
-- 0009_rls.sql
-- ============================================================

-- 0009_rls.sql
-- Bat RLS tren MOI bang, deny-by-default.
-- Ghi nho: service_role BYPASS RLS -> bang "service role only" chi can bat RLS,
-- KHONG them policy permissive cho anon/authenticated.
-- Policy drop-if-exists truoc create de chay lai an toan.

-- ===========================================================================
-- ENABLE RLS (tat ca bang)
-- ===========================================================================
alter table public.profiles            enable row level security;
alter table public.products            enable row level security;
alter table public.plans               enable row level security;
alter table public.plan_products       enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.device_activations  enable row level security;
alter table public.trials              enable row level security;
alter table public.orders              enable row level security;
alter table public.payments            enable row level security;
alter table public.order_counter       enable row level security;
alter table public.revoked_devices     enable row level security;
alter table public.usage_events        enable row level security;
alter table public.check_logs          enable row level security;
alter table public.command_registry    enable row level security;
alter table public.email_campaigns     enable row level security;
alter table public.email_logs          enable row level security;
alter table public.email_unsubscribes  enable row level security;
alter table public.admin_users         enable row level security;

-- ===========================================================================
-- profiles: owner read + owner update (insert qua trigger SECURITY DEFINER)
-- ===========================================================================
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ===========================================================================
-- Catalog: products / plans / plan_products / command_registry -> public SELECT
-- ===========================================================================
drop policy if exists products_select_public on public.products;
create policy products_select_public on public.products
  for select to anon, authenticated using (true);

drop policy if exists plans_select_public on public.plans;
create policy plans_select_public on public.plans
  for select to anon, authenticated using (true);

drop policy if exists plan_products_select_public on public.plan_products;
create policy plan_products_select_public on public.plan_products
  for select to anon, authenticated using (true);

drop policy if exists command_registry_select_public on public.command_registry;
create policy command_registry_select_public on public.command_registry
  for select to anon, authenticated using (true);

-- ===========================================================================
-- subscriptions: owner SELECT only (writes = service role)
-- ===========================================================================
drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid());

-- ===========================================================================
-- trials: owner SELECT only (writes = service role)
-- ===========================================================================
drop policy if exists trials_select_own on public.trials;
create policy trials_select_own on public.trials
  for select to authenticated
  using (user_id = auth.uid());

-- ===========================================================================
-- orders: owner SELECT only (writes = service role)
-- ===========================================================================
drop policy if exists orders_select_own on public.orders;
create policy orders_select_own on public.orders
  for select to authenticated
  using (user_id = auth.uid());

-- ===========================================================================
-- payments: owner SELECT only (qua order) (writes = service role)
-- ===========================================================================
drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = payments.order_id
        and o.user_id = auth.uid()
    )
  );

-- ===========================================================================
-- device_activations: owner SELECT + owner INSERT/UPDATE cua chinh minh
-- (service role full qua bypass)
-- ===========================================================================
drop policy if exists device_activations_select_own on public.device_activations;
create policy device_activations_select_own on public.device_activations
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists device_activations_insert_own on public.device_activations;
create policy device_activations_insert_own on public.device_activations
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists device_activations_update_own on public.device_activations;
create policy device_activations_update_own on public.device_activations
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===========================================================================
-- usage_events: owner SELECT + owner INSERT (user_id = auth.uid()).
-- KHONG cho update/delete.
-- ===========================================================================
drop policy if exists usage_events_select_own on public.usage_events;
create policy usage_events_select_own on public.usage_events
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists usage_events_insert_own on public.usage_events;
create policy usage_events_insert_own on public.usage_events
  for insert to authenticated
  with check (user_id = auth.uid());

-- ===========================================================================
-- Service-role-only tables: chi bat RLS, KHONG policy anon/authenticated.
--   order_counter, revoked_devices, check_logs,
--   email_campaigns, email_logs, email_unsubscribes, admin_users
-- (service_role bypass RLS nen van doc/ghi binh thuong tu API server.)
-- => Khong tao policy nao = deny tat ca client anon/authenticated.
-- ===========================================================================


-- ============================================================
-- 0010_cron.sql
-- ============================================================

-- 0010_cron.sql
-- pg_cron schedules. Lich cron expr theo UTC.
-- VN = UTC+7, vi du '10 0 * * *' (UTC) ~ 07:10 VN. Dieu chinh neu can.
-- An toan chay lai: unschedule truoc neu job da ton tai.

-- ---------------------------------------------------------------------------
-- Helper: huy job theo ten neu da ton tai (tranh loi "job already exists").
-- ---------------------------------------------------------------------------
do $$
declare
  j text;
begin
  foreach j in array array['daily_expire','daily_rollup','daily_cleanup'] loop
    perform cron.unschedule(j)
    where exists (select 1 from cron.job where jobname = j);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- daily_expire — 00:10: danh dau sub het han.
-- ---------------------------------------------------------------------------
select cron.schedule(
  'daily_expire',
  '10 0 * * *',
  $$
    update public.subscriptions
       set status = 'expired', updated_at = now()
     where current_period_end < now()
       and status = 'active';
  $$
);

-- ---------------------------------------------------------------------------
-- daily_rollup — 00:20: refresh materialized view (CONCURRENTLY can unique index).
-- ---------------------------------------------------------------------------
select cron.schedule(
  'daily_rollup',
  '20 0 * * *',
  $$
    refresh materialized view concurrently public.mv_tool_daily;
  $$
);

-- ---------------------------------------------------------------------------
-- daily_cleanup — 03:00: don du lieu cu.
--   usage_events > 180 ngay, check_logs > 90 ngay, orders pending > 7 ngay.
-- ---------------------------------------------------------------------------
select cron.schedule(
  'daily_cleanup',
  '0 3 * * *',
  $$
    delete from public.usage_events where created_at < now() - interval '180 days';
    delete from public.check_logs   where at         < now() - interval '90 days';
    delete from public.orders
      where status = 'pending'
        and created_at < now() - interval '7 days';
  $$
);

-- ===========================================================================
-- expiry_mailer (HTTP qua pg_net) — DE COMMENT.
-- ===========================================================================
-- NOTE: Job nay goi route Next.js de render + gui email nhac het han.
-- BAN PHAI dien:
--   1) <YOUR_DOMAIN>  = domain production (vd license.tencuaban.com)
--   2) <CRON_SECRET>  = chuoi bi mat trung voi env CRON_SECRET cua route Next.js
-- Lich '0 1 * * *' (UTC) ~ 08:00 VN. Bo comment khi da deploy route.
--
-- select cron.schedule(
--   'expiry_mailer',
--   '0 1 * * *',
--   $$
--     select net.http_post(
--       url     := 'https://<YOUR_DOMAIN>/api/cron/expiry-mailer',
--       headers := jsonb_build_object(
--         'Content-Type',  'application/json',
--         'Authorization', 'Bearer <CRON_SECRET>'
--       ),
--       body    := '{}'::jsonb
--     );
--   $$
-- );
--
-- Debug ket qua HTTP async: select * from net._http_response order by created desc limit 20;
