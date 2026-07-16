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
