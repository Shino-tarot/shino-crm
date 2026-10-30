-- 統合テスト用の申込と、それぞれが登録されている顧客の確認(読み取りのみ)。LINE表示名が【テスト】統合確認B の申込だけを見る
-- request_name / request_birth_date = 申込に書かれた内容、customer_no / customer_name / customer_birthday = 登録先の顧客
-- 「統合元テストB」の申込の customer_no が「統合先テストB」と別の新しい番号なら正常。No.12 など以前の顧客なら、その顧客に登録されている
select
  r.account_id,
  r.reading_name as request_name,
  r.birth_date as request_birth_date,
  r.created_at,
  c.customer_no,
  c.reading_name as customer_name,
  c.birthday as customer_birthday,
  c.deleted_at is not null as customer_hidden,
  (select count(*) from public.free_reading_requests x where x.customer_id = c.id) as customer_request_count
from public.free_reading_requests r
left join public.customers c on c.id = r.customer_id
where r.line_name = '【テスト】統合確認B'
order by r.created_at;
