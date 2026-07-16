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
