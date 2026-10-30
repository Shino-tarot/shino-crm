-- 顧客のアカウント別件数(読み取りのみ)。期待値: taiko=3、yayoi=1、account_id_null=0
select
  count(*) filter (where account_id = 'taiko') as taiko,
  count(*) filter (where account_id = 'yayoi') as yayoi,
  count(*) filter (where account_id is null) as account_id_null,
  count(*) as total
from public.customers;
