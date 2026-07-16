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
