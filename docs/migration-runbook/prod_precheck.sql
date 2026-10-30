-- 本番DBの事前確認(読み取りのみ。データの中身は読まず、件数と true/false だけを表示する)
-- ready = true なら、next_migration の番号から phase-a を始めてよい。false なら blockers を確認して相談する。
-- どの状態のDBで実行してもエラーにならないよう、存在しない可能性がある列は query_to_xml で条件付きに数える。
with f as (
  select
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'free_reading_requests' and column_name = 'contact_method') as m04,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'free_reading_requests' and column_name = 'memo') as m05,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'free_reading_requests' and column_name = 'application_date') as m06,
    (to_regclass('public.paid_readings') is not null) as m08,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'free_reading_requests' and column_name = 'sent_reading_content') as m09,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'free_reading_requests' and column_name = 'diagnosis_code') as has_diag,
    (to_regclass('public.status_auto_updates') is not null) as m11,
    (to_regclass('public.line_contacts') is not null) as m12,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'customers' and column_name = 'deleted_at') as m13,
    exists (select 1 from pg_trigger where tgname = 'customers_prevent_physical_delete') as m14,
    (to_regclass('public.customer_merges') is not null) as m15,
    (to_regclass('public.accounts') is not null) as m16,
    exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'customers' and column_name = 'account_id' and is_nullable = 'NO') as m18,
    not has_table_privilege('anon', 'public.free_reading_requests', 'INSERT') as m19
), g as (
  select f.*,
    (m09 and not has_diag) as m10,
    -- 0017: 顧客に account_id が空欄の行が無い(0016より前は false)
    -- (CASE で囲むのは、0016より前は account_id 列が無いため。AND は評価順が保証されない)
    case when m16 then (xpath('/row/n/text()', query_to_xml('select count(*) as n from public.customers where account_id is null', false, true, '')))[1]::text::int = 0
         else false end as m17
  from f
), s as (
  select g.*,
    array[m04, m05, m06, m08, m09, m10, m11, m12, m13, m14, m15, m16, m17, m18, m19] as flags,
    array['0004','0005','0006','0008','0009','0010','0011','0012','0013','0014','0015','0016','0017','0018','0019'] as names
  from g
), n as (
  select s.*,
    coalesce((select i from generate_subscripts(flags, 1) i where not flags[i] order by i limit 1), 0) as first_missing
  from s
), b as (
  select n.*,
    (first_missing = 0 or not (true = any (flags[first_missing:]))) as state_consistent,
    (select count(*) from public.free_reading_requests where status not in (
       'new', 'contacted', 'converted', 'archived', 'awaiting_free_reading', 'in_reading',
       'free_reading_sent', 'paid_reading_proposed', 'completed', 'paid_reading_sent')) as status_outside_allowed,
    case when m04 then 0 else (select count(*) from public.free_reading_requests) end as rows_blocking_0004,
    case when has_diag then (xpath('/row/n/text()', query_to_xml(
      'select count(*) as n from public.free_reading_requests where diagnosis_code is not null or diagnosis_theme is not null or diagnosis_result_type is not null',
      false, true, '')))[1]::text::int else 0 end as diagnosis_values,
    case when has_diag then (xpath('/row/n/text()', query_to_xml(
      'select count(*) as n from public.free_reading_requests where diagnosed_at is not null', false, true, '')))[1]::text::int else 0 end as diagnosed_at_values,
    (select count(*) from (select line_user_id from public.customers where line_user_id <> '' group by line_user_id having count(*) > 1) d) as duplicate_line_user_ids,
    (select tableowner from pg_tables where schemaname = 'public' and tablename = 'customers') as customers_owner,
    (select rolsuper from pg_roles where rolname = 'service_role') as service_role_is_superuser
  from n
)
select
  case when first_missing = 0 then 'none' else names[first_missing] end as next_migration,
  state_consistent
    and (m04 or rows_blocking_0004 = 0)
    and (m10 or status_outside_allowed = 0)
    and (m11 or status_outside_allowed = 0)
    and (m10 or (diagnosis_values = 0 and diagnosed_at_values <= 2))
    and (m12 or duplicate_line_user_ids = 0)
    and (m14 or (customers_owner = 'postgres' and service_role_is_superuser = false))
    as ready,
  array_to_string(array_remove(array[
    case when not state_consistent then '適用状況が飛び飛び(番号の途中が未適用)' end,
    case when not m04 and rows_blocking_0004 > 0 then '0004: 申込があるため列追加ができない' end,
    case when (not m10 or not m11) and status_outside_allowed > 0 then '0010/0011: 許可されていないステータスの申込がある' end,
    case when not m10 and (diagnosis_values > 0 or diagnosed_at_values > 2) then '0010: 削除される診断列に承認範囲外の値がある' end,
    case when not m12 and duplicate_line_user_ids > 0 then '0012: 顧客のLINE User IDに重複がある' end,
    case when not m14 and (customers_owner <> 'postgres' or service_role_is_superuser) then '0014: 削除防止の前提(所有者・権限)が想定と違う' end
  ], null), ' / ') as blockers,
  state_consistent,
  array_to_string(array(select names[i] from generate_subscripts(flags, 1) i where flags[i]), ',') as applied,
  (select count(*) from public.customers) as customers_total,
  (select count(*) from public.free_reading_requests) as requests_total,
  status_outside_allowed, rows_blocking_0004, diagnosis_values, diagnosed_at_values, duplicate_line_user_ids
from b;
