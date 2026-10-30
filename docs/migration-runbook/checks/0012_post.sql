-- 0012 実行後の確認(読み取りのみ)。期待値: テーブル2、トリガー4、RLS有効、顧客のLINE User ID重複禁止 true
select
  ((to_regclass('public.line_contacts') is not null)::int + (to_regclass('public.conversation_messages') is not null)::int) as added_tables, -- 2
  (select count(*) from pg_trigger where tgname in ('line_contacts_check_customer_match', 'customers_check_line_user_id_match', 'conversation_messages_protect', 'line_contacts_set_updated_at')) as triggers, -- 4
  (select bool_and(relrowsecurity) from pg_class where oid in ('public.line_contacts'::regclass, 'public.conversation_messages'::regclass)) as rls_enabled, -- true
  (to_regclass('public.customers_line_user_id_unique_idx') is not null) as customer_line_id_unique; -- true(false なら重複があるため追加されていない)
