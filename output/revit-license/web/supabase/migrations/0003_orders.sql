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
