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
