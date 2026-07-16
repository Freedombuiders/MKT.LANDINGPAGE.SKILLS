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
