-- 公開用キー(anon)で申込を直接書き込めないことの確認(検証用DB shino-crm-test 専用)
-- 期待結果: 「permission denied for table free_reading_requests」のエラーになる(=拒否されている)
-- 万一書き込めてしまった場合も、最後の rollback で取り消されるため、データは残らない
begin;
set local role anon;
insert into public.free_reading_requests (account_id, contact_method) values ('yayoi', 'line');
rollback;
