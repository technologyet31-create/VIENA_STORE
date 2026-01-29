-- VIENNA Items schema patch
-- هدفها: منع أخطاء 400 عند حفظ الصنف من صفحة الأصناف.
-- شغّل هذا في SQL editor داخل Supabase.

-- Adds common columns used by the UI if they are missing.
alter table public.items
  add column if not exists description text null,
  add column if not exists image text null,
  add column if not exists qrcode text null;

-- Helpful index for QR lookups (optional)
create index if not exists items_qrcode_idx on public.items (qrcode);
