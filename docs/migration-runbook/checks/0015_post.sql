-- 0015 実行後の確認(読み取りのみ)。期待値: 2, 0, true, false, false, 0
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'customers' and column_name in ('merged_into_customer_id', 'merged_at')) as added_columns, -- 2
  (select count(*) from public.customer_merges) as merge_logs, -- 0
  has_function_privilege('service_role', 'public.merge_customers(uuid, uuid, uuid)', 'EXECUTE') as fn_service_role, -- true
  has_function_privilege('anon', 'public.merge_customers(uuid, uuid, uuid)', 'EXECUTE') as fn_anon, -- false
  has_function_privilege('authenticated', 'public.merge_customers(uuid, uuid, uuid)', 'EXECUTE') as fn_authenticated, -- false
  (select count(*) from public.customers where merged_into_customer_id is not null) as merged_customers; -- 0
