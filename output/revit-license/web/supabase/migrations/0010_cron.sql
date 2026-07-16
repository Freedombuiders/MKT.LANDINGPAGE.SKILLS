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
