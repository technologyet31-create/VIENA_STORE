-- VIENNA Orders schema v2 follow-ups
-- هدفها: تحسين الربط بين orders.customer_id و customers + (اختياري) backfill من notes القديمة.
-- شغّل هذا في SQL editor داخل Supabase بعد تشغيل 2026-01-29_orders_schema_v2.sql

-- 1) Optional foreign key: orders.customer_id -> customers.id
-- NOTE: هذا يتطلب أن values الموجودة في orders.customer_id تكون NULL أو موجودة في customers.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='customer_id')
     and exists (select 1 from information_schema.tables where table_schema='public' and table_name='customers')
  then
    if not exists (select 1 from pg_constraint where conname = 'orders_customer_fk') then
      alter table public.orders
        add constraint orders_customer_fk
        foreign key (customer_id) references public.customers(id)
        on delete set null;
    end if;
  end if;
end $$;

create index if not exists orders_customer_id_idx on public.orders(customer_id);

-- 2) Optional unique phone (only if safe)
-- إذا كان عندك تكرار في phone، سيتم تخطي إنشاء الـ unique index.
do $$
declare
  dup_count int;
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='customers') then
    select count(*) into dup_count
    from (
      select phone from public.customers
      where phone is not null and length(trim(phone)) > 0
      group by phone
      having count(*) > 1
    ) d;

    if dup_count = 0 then
      if not exists (select 1 from pg_indexes where schemaname='public' and indexname='customers_phone_unique') then
        create unique index customers_phone_unique on public.customers(phone) where phone is not null and length(trim(phone)) > 0;
      end if;
    end if;
  end if;
end $$;

-- 3) Backfill v2 columns from legacy JSON stored in orders.notes
-- (Only fills columns when they are NULL)
create or replace function public.try_parse_jsonb(txt text)
returns jsonb
language plpgsql
as $$
declare
  j jsonb;
begin
  if txt is null or length(trim(txt)) = 0 then
    return null;
  end if;
  begin
    j := txt::jsonb;
    return j;
  exception when others then
    return null;
  end;
end $$;

-- Fill orders customer columns from notes JSON
update public.orders o
set
  customer_name = coalesce(o.customer_name, public.try_parse_jsonb(o.notes)->'customer'->>'name'),
  customer_phone = coalesce(o.customer_phone, public.try_parse_jsonb(o.notes)->'customer'->>'phone'),
  customer_phone_extra = coalesce(o.customer_phone_extra, public.try_parse_jsonb(o.notes)->'customer'->>'phoneExtra'),
  customer_address = coalesce(o.customer_address, public.try_parse_jsonb(o.notes)->'customer'->>'address')
where
  (o.customer_name is null or o.customer_phone is null or o.customer_address is null or o.customer_phone_extra is null)
  and public.try_parse_jsonb(o.notes) is not null;

-- 4) Optional: create customers from orders (if you want to start building a customers registry)
-- This inserts only when phone is present and not already in customers.
insert into public.customers (name, phone, phone_extra, address, notes)
select
  o.customer_name,
  o.customer_phone,
  o.customer_phone_extra,
  o.customer_address,
  null
from public.orders o
where
  o.customer_phone is not null and length(trim(o.customer_phone)) > 0
  and exists (select 1 from information_schema.tables where table_schema='public' and table_name='customers')
  and not exists (
    select 1 from public.customers c
    where c.phone = o.customer_phone
  );
