-- service_role: 3テーブルすべてに対する全操作権限を付与
-- (このプロジェクトでは新規テーブル作成時にservice_roleへの自動GRANTが
--  行われておらず、42501 permission deniedが発生していたため)

grant select, insert, update, delete
on table public.customers
to service_role;

grant select, insert, update, delete
on table public.customer_records
to service_role;

grant select, insert, update, delete
on table public.free_reading_requests
to service_role;
