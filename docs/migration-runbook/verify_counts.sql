-- (内部用) バックアップと比べて件数が減っていないこと。sqlcopy.sh が verify-a / verify-b に組み込む
(select coalesce(string_agg(c.relname, ', '), '') from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'backup_before_prod_migration' and c.relkind = 'r'
    and to_regclass('public.' || c.relname) is not null
    and (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text::int
      < (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from backup_before_prod_migration.%I', c.relname), false, true, '')))[1]::text::int)
