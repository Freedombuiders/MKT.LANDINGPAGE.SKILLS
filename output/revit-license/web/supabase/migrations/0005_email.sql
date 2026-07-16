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
