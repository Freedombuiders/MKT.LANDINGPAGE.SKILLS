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
