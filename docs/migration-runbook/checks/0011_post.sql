-- 0011 実行後の確認(読み取りのみ)。期待値: 列2、テーブル2、導入日時2、制約2
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'free_reading_requests' and column_name in ('detail_request', 'followed_up_at')) as added_columns,       -- 2
  ((to_regclass('public.status_auto_updates') is not null)::int + (to_regclass('public.crm_feature_launches') is not null)::int) as added_tables, -- 2
  (select count(*) from public.crm_feature_launches) as feature_launches,                                                 -- 2
  (select count(*) from pg_constraint where conname in ('free_reading_requests_status_check', 'free_reading_requests_detail_request_check')) as constraints; -- 2
