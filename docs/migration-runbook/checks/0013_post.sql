-- 0013 実行後の確認(読み取りのみ)。期待値: 列2、非表示0
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'customers' and column_name in ('deleted_at', 'deleted_by')) as added_columns, -- 2
  (select count(*) from public.customers where deleted_at is not null) as hidden_customers; -- 0
