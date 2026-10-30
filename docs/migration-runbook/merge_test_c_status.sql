-- テストC(統合元テストC・統合先テストC)の現在の状態と、実際の統合記録(読み取りのみ)
-- merged_into_no = その顧客の統合先の顧客番号。統合記録は source_no → target_no の向き
select
  c.reading_name,
  c.customer_no,
  c.account_id,
  c.deleted_at is not null as hidden,
  (select x.customer_no from public.customers x where x.id = c.merged_into_customer_id) as merged_into_no,
  (select count(*) from public.free_reading_requests r where r.customer_id = c.id) as requests,
  (select string_agg(
            (select s.customer_no from public.customers s where s.id = g.source_customer_id) || ' → ' ||
            (select t.customer_no from public.customers t where t.id = g.target_customer_id) || '（' || to_char(g.created_at, 'MM/DD HH24:MI') || '）',
            ', ')
     from public.customer_merges g
    where g.source_customer_id = c.id or g.target_customer_id = c.id) as merge_logs
from public.customers c
where c.reading_name in ('統合元テストC', '統合先テストC')
order by c.created_at;
