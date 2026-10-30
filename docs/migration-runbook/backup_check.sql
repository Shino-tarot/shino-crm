-- バックアップの確認(読み取りのみ)。全テーブルについて件数と内容のハッシュ(md5)が public と一致すれば ok = true
-- (内容まで一致する = バックアップから行を取り出して復元に使える状態であることの確認)
with t as (
  select c.relname as table_name,
    (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text::int as public_count,
    (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from backup_before_prod_migration.%I', c.relname), false, true, '')))[1]::text::int as backup_count,
    (xpath('/row/h/text()', query_to_xml(format('select md5(coalesce(string_agg(x::text, %L order by x::text), %L)) as h from public.%I x', chr(10), '', c.relname), false, true, '')))[1]::text as public_hash,
    (xpath('/row/h/text()', query_to_xml(format('select md5(coalesce(string_agg(x::text, %L order by x::text), %L)) as h from backup_before_prod_migration.%I x', chr(10), '', c.relname), false, true, '')))[1]::text as backup_hash
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'backup_before_prod_migration' and c.relkind = 'r'
)
select
  count(*) > 0 and bool_and(public_count = backup_count and public_hash = backup_hash) as ok,
  count(*) as tables_backed_up,
  string_agg(table_name || '=' || backup_count, ', ' order by table_name) as backup_counts,
  coalesce(string_agg(table_name, ', ') filter (where public_count <> backup_count or public_hash <> backup_hash), '') as mismatched_tables
from t;
