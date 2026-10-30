-- 0014 実行前の確認(読み取りのみ)。期待値: 所有者 postgres、他はすべて false
select
  (select tableowner from pg_tables where schemaname = 'public' and tablename = 'customers') as customers_owner, -- postgres
  pg_has_role('service_role', (select tableowner from pg_tables where schemaname = 'public' and tablename = 'customers'), 'MEMBER') as service_role_is_owner_member, -- false
  (select rolsuper from pg_roles where rolname = 'service_role') as service_role_is_superuser, -- false
  has_parameter_privilege('service_role', 'session_replication_role', 'SET') as service_role_can_disable_triggers; -- false
