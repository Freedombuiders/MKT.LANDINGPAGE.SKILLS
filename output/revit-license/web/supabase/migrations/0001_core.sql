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
