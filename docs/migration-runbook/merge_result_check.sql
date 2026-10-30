-- 統合テスト(テストC)の結果確認(読み取りのみ。件数と true/false だけを表示)
-- 名前ではなく「実際の統合記録」から統合元・統合先を決めるため、どちらの画面から実行しても正しく確認できる
with test_customers as (
  select id from public.customers where reading_name in ('統合元テストC', '統合先テストC')
), mrg as (
  select g.* from public.customer_merges g
  where g.source_customer_id in (select id from test_customers) or g.target_customer_id in (select id from test_customers)
  order by g.created_at desc limit 1
), src as (
  select c.* from public.customers c join mrg on c.id = mrg.source_customer_id
), tgt as (
  select c.* from public.customers c join mrg on c.id = mrg.target_customer_id
)
select
  (select reading_name from src) as source_name,                                                    -- 非表示になった側
  (select reading_name from tgt) as target_name,                                                    -- 残った側
  (select deleted_at is not null from src) as source_hidden,                                        -- true
  (select src.merged_into_customer_id = tgt.id from src, tgt) as source_merged_into_target,        -- true
  (select count(*) from public.free_reading_requests r, src where r.customer_id = src.id) as source_requests, -- 0
  (select deleted_at is null from tgt) as target_visible,                                          -- true
  (select count(*) from public.free_reading_requests r, tgt where r.customer_id = tgt.id) as target_requests, -- 2
  (select account_id from mrg) as merge_account,                                                   -- taiko
  (select count(*) from mrg) as merge_logs,                                                        -- 1(0 なら統合記録が見つからない)
  -- 統合以降に変更された、統合元・統合先以外の顧客と申込(0 なら影響なし。統合記録が無い場合は null)
  (select count(*) from public.customers c
   where c.id not in (select id from src union all select id from tgt)
     and c.updated_at >= (select created_at from mrg)) as other_customers_changed,                -- 0
  (select count(*) from public.free_reading_requests r
   where r.customer_id is distinct from (select id from tgt)
     and r.updated_at >= (select created_at from mrg)) as other_requests_changed,                 -- 0
  (select count(*) from public.customer_merges where account_id <> 'taiko') as yayoi_merges,       -- 0
  (select count(*) from public.customers where account_id = 'yayoi' and merged_into_customer_id is not null) as yayoi_merged_customers, -- 0
  (select count(*) from public.customers) as customers_total;                                      -- 統合前と同じ
