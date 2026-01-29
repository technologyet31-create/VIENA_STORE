-- VIENNA Orders schema v2 (Supabase/Postgres)
-- هدفها: تخزين بيانات الزبون/المندوب/الحالة كأعمدة (بدلاً من JSON داخل notes)
-- ملاحظة: شغّل هذا في SQL editor داخل Supabase.

-- 1) Helpers
create extension if not exists pgcrypto;

-- 2) (اختياري) Enum للحالات
do $$
begin
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum (
      'جديد',
      'مع المندوب',
      'تمت التوصيل',
      'في انتظار التسوية',
      'تمت التسوية',
      'ملغي'
    );
  end if;
end $$;

-- 3) Customers table (اختياري لكنه مفيد)
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text null,
  phone text null,
  phone_extra text null,
  address text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_phone_idx on public.customers (phone);

-- 4) Orders: add structured columns
alter table public.orders
  add column if not exists customer_name text null,
  add column if not exists customer_phone text null,
  add column if not exists customer_phone_extra text null,
  add column if not exists customer_address text null,
  add column if not exists driver_name text null,
  add column if not exists updated_at timestamptz not null default now();

-- Ensure date has default
alter table public.orders
  alter column date set default now();

-- (optional) Convert status to enum (if currently text)
-- WARNING: only run if you are sure existing values match the enum.
-- alter table public.orders
--   alter column status type order_status using status::order_status;

-- If you don't want enum, enforce check constraint instead:
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'orders_status_check'
  ) then
    alter table public.orders
      add constraint orders_status_check
      check (status in ('جديد','مع المندوب','تمت التوصيل','في انتظار التسوية','تمت التسوية','ملغي'));
  end if;
exception when others then
  -- Ignore if status column doesn't exist or constraint can't be created
end $$;

-- 5) order_items constraints + useful defaults
alter table public.order_items
  add column if not exists created_at timestamptz not null default now();

-- Add foreign keys if missing
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'order_items_order_fk') then
    alter table public.order_items
      add constraint order_items_order_fk
      foreign key (order_id) references public.orders(id)
      on delete cascade;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'order_items_item_fk') then
    alter table public.order_items
      add constraint order_items_item_fk
      foreign key (item_id) references public.items(id)
      on delete restrict;
  end if;
end $$;

-- Avoid duplicates of same item in one order
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'order_items_unique_order_item') then
    alter table public.order_items
      add constraint order_items_unique_order_item unique (order_id, item_id);
  end if;
end $$;

-- qty must be positive
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'order_items_qty_check') then
    alter table public.order_items
      add constraint order_items_qty_check check (qty > 0);
  end if;
end $$;

create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_item_id_idx on public.order_items(item_id);

-- 6) updated_at triggers
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- customers
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_customers_updated_at') then
    create trigger trg_customers_updated_at
    before update on public.customers
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- orders
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_orders_updated_at') then
    create trigger trg_orders_updated_at
    before update on public.orders
    for each row execute function public.set_updated_at();
  end if;
end $$;
