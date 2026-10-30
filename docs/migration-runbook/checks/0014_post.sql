-- 0014 実行後の確認(読み取りのみ)。期待値: false, false, true, true, true, 'O'
select
  has_table_privilege('service_role', 'public.customers', 'DELETE') as service_role_can_delete,     -- false
  has_table_privilege('service_role', 'public.customers', 'TRUNCATE') as service_role_can_truncate, -- false
  has_table_privilege('service_role', 'public.customers', 'SELECT') as can_select,                  -- true
  has_table_privilege('service_role', 'public.customers', 'INSERT') as can_insert,                  -- true
  has_table_privilege('service_role', 'public.customers', 'UPDATE') as can_update,                  -- true
  (select tgenabled from pg_trigger where tgrelid = 'public.customers'::regclass and tgname = 'customers_prevent_physical_delete') as delete_guard; -- O
