-- ブラウザでの統合テストの結果確認(読み取りのみ)。名前が「統合元テストB」「統合先テストB」「夜宵テストB」のテスト顧客だけを見る
-- 期待値(統合後): 統合元テストB = hidden true / merged true / 申込0 / 会話(手動)0
--                 統合先テストB = hidden false / merged false / 申込2 / 会話(手動)1
--                 夜宵テストB   = account yayoi / hidden false / 申込1(統合されない)
select
  c.reading_name,
  c.account_id,
  c.customer_no,
  c.deleted_at is not null as hidden,
  c.merged_into_customer_id is not null as merged,
  (select count(*) from public.free_reading_requests r where r.customer_id = c.id) as requests,
  (select count(*) from public.conversation_messages m where m.customer_id = c.id and m.source = 'manual') as manual_messages,
  (select count(*) from public.customer_merges g where g.source_customer_id = c.id or g.target_customer_id = c.id) as merge_logs
from public.customers c
where c.reading_name in ('統合元テストB', '統合先テストB', '夜宵テストB')
order by c.account_id, c.reading_name;
