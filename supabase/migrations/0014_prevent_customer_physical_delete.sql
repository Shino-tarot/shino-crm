-- 顧客(customers)の物理削除をDB側でも禁止するためのDB変更
--
-- 【実行状況】検証用DB(shino-crm-test): 実行済み / 本番DB: 未実行
-- 実行はオーナーが明示的に指示したタイミングで行うこと(まず検証用DBのみ)。
-- 前提: 0013_customers_soft_delete.sql が適用済みで、アプリの削除ボタンが「非表示」に切り替わっていること
--       (切り替え前に実行すると、旧アプリの削除ボタンがエラーになる)。
--
-- 背景:
--   アプリからは顧客の物理削除を取り除き、非表示(deleted_atのセット)に置き換えた。
--   しかしDB上は service_role に DELETE 権限が残っており(0003_grant_service_role.sql)、
--   誤ったコードや直接のAPI呼び出しで削除されると、外部キーの設定により次のデータが連動して失われる。
--     - paid_readings / upsell_purchases / customer_records / conversation_messages(手動登録分): 完全に削除
--     - free_reading_requests / line_contacts: 顧客との紐づけが外れる
--   そのため、権限とトリガーの二重でDB側からも物理削除を防ぐ。
--
-- 変更内容:
--   1. customers の DELETE・TRUNCATE 権限を public / anon / authenticated / service_role から取り消す
--      → アプリ・APIキー経由では削除の命令そのものが権限エラーで拒否される
--        (権限の確認はトリガーより先に行われる。SELECT/INSERT/UPDATEは変更しない)
--   2. customers への DELETE・TRUNCATE を「例外なく」拒否するトリガーを追加する
--      → 文単位(for each statement)のため、対象行が0件の削除命令・TRUNCATE ... CASCADE・
--        MERGE の DELETE も拒否する。テーブル所有者(SQL Editorのpostgres)も含め全ロールが対象
--      → 将来、誤って service_role に DELETE 権限が再付与されても(例: grant all on all tables)、
--        このトリガーで止まる
--
-- 例外(法的な削除依頼など)の扱い:
--   トリガー内に「この設定なら通す」といった抜け道は設けない
--   (shino_crm.xxx のような独自設定は権限の無いロールでも set できるため、抜け道の条件に使うと危険)。
--   本当に削除が必要な場合は、テーブル所有者だけが実行できる
--   「alter table ... disable trigger」を1つのトランザクション内で使う(ファイル末尾の手順を参照)。
--   service_role はテーブル所有者ではないため、この操作はできない。
--
-- このファイルで「しないこと」:
--   - 既存の行・値は一切変更・削除しない(UPDATE/DELETEを含まない)
--   - 外部キー(on delete cascade / set null)は変更しない
--   - 非表示・復元(UPDATE)には影響しない(UPDATE権限・UPDATEトリガーは変更しない)
--   - 他のテーブル(申込・有料鑑定・記録など)の権限は変更しない
--
-- 再実行について:
--   「revoke」「create or replace」「drop ... if exists → create」で書いており、
--   2回実行しても結果は変わらない。途中で失敗した場合はトランザクションにより全体が取り消される。
--
-- 【実行前の確認】(読み取りのみ。想定と違う場合は実行せずに相談すること)
--   -- (p1) customers の所有者(postgres を想定。service_role / authenticator ではないこと)
--   select tableowner from pg_tables where schemaname = 'public' and tablename = 'customers';
--   -- (p2) service_role が所有者ロールのメンバーでなく、スーパーユーザーでもないこと(すべて false を想定)
--   select
--     pg_has_role('service_role', (select tableowner from pg_tables
--                                  where schemaname = 'public' and tablename = 'customers'), 'MEMBER') as service_role_is_owner_member,
--     (select rolsuper from pg_roles where rolname = 'service_role') as service_role_is_superuser;
--   -- (p3) service_role がトリガーを無効化する設定(session_replication_role)を変更できないこと(false を想定)
--   select has_parameter_privilege('service_role', 'session_replication_role', 'SET') as service_role_can_disable_triggers;
--
-- 実行後の確認(読み取りのみ):
--   -- (a) service_role に DELETE・TRUNCATE 権限が無いこと(両方 false なら成功)
--   select
--     has_table_privilege('service_role', 'public.customers', 'DELETE') as service_role_can_delete,
--     has_table_privilege('service_role', 'public.customers', 'TRUNCATE') as service_role_can_truncate;
--   -- (b) SELECT・INSERT・UPDATE 権限は残っていること(すべて true なら成功)
--   select
--     has_table_privilege('service_role', 'public.customers', 'SELECT') as can_select,
--     has_table_privilege('service_role', 'public.customers', 'INSERT') as can_insert,
--     has_table_privilege('service_role', 'public.customers', 'UPDATE') as can_update;
--   -- (c) トリガーが有効な状態で追加されたこと(tgenabled が 'O' の1行が表示されれば成功)
--   select tgname, tgenabled from pg_trigger
--   where tgrelid = 'public.customers'::regclass and tgname = 'customers_prevent_physical_delete';
--   -- (d) 削除が拒否されること(存在しないIDを指定するため、どの顧客も対象にならない)
--   --     「顧客は削除できません」のエラーが出れば成功。必ず rollback まで実行すること
--   begin;
--   delete from public.customers where id = '00000000-0000-0000-0000-000000000000';
--   rollback;
--
-- 元に戻す場合(このファイルの変更のみを取り消す):
--   drop trigger if exists customers_prevent_physical_delete on public.customers;
--   drop function if exists public.prevent_customer_physical_delete();
--   grant delete on table public.customers to service_role;

begin;

-- ============================================================
-- 1. 削除権限の取り消し(SELECT/INSERT/UPDATEは残す)
-- ============================================================
-- 付与されていない権限の取り消しはエラーにならない(何も起きない)
revoke delete, truncate on table public.customers
  from public, anon, authenticated, service_role;

-- ============================================================
-- 2. 物理削除を例外なく拒否するトリガー
-- ============================================================
-- 抜け道となる条件分岐は持たない。呼び出し元の権限で動く(security invoker)。
create or replace function public.prevent_customer_physical_delete()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception
    '顧客は削除できません。顧客管理の「非表示」を使ってください(操作: %)', tg_op
    using hint = '法的な削除依頼への対応は、0014_prevent_customer_physical_delete.sql 末尾の手順を参照してください';
end;
$$;

comment on function public.prevent_customer_physical_delete() is
  'customersの物理削除(DELETE/TRUNCATE)を例外なく拒否する。削除依頼への対応はテーブル所有者がトリガーを一時的に無効化して行う';

-- アプリ・APIから直接呼び出せないようにする(トリガーからの実行には影響しない)
revoke execute on function public.prevent_customer_physical_delete()
  from public, anon, authenticated, service_role;

drop trigger if exists customers_prevent_physical_delete on public.customers;
create trigger customers_prevent_physical_delete
  before delete or truncate on public.customers
  for each statement execute function public.prevent_customer_physical_delete();

commit;

-- ============================================================
-- 削除依頼への対応(参考。このファイルでは実行しない)
-- ============================================================
-- 法的な削除依頼などで、本当に顧客データを消す必要がある場合の考え方:
--   1. 対象の顧客と関連データ(申込・有料鑑定・アップセル・記録・会話履歴・LINE送信者)を確認し、
--      削除の範囲をオーナーが決める。実行前にバックアップを取る。
--   2. customers を削除しても、free_reading_requests と line_contacts は残る(紐づけが外れるだけ)ため、
--      これらにある個人情報も対象なら、customersより先に明示的に削除する。
--   3. LINEから自動保存した会話履歴は、0012のトリガー(protect_conversation_message)により
--      アプリからは削除できない。対象にする場合は、同じ手順でそのトリガーも一時的に無効化する。
--   4. SQL Editor(テーブル所有者)で、1つのトランザクションとして実行する。
--      トリガーの無効化は「テーブル所有者」しか実行できず(service_roleは不可)、
--      トランザクション中はテーブルがロックされるため、他の操作が割り込むことはない。
--      途中でエラーになった場合は rollback され、トリガーも自動的に有効な状態に戻る。
--        begin;
--        alter table public.customers disable trigger customers_prevent_physical_delete;
--        -- (関連データの削除)
--        delete from public.customers where id = '<対象の顧客ID>';
--        alter table public.customers enable trigger customers_prevent_physical_delete;
--        commit;
--      実行後、確認(c)でトリガーが有効('O')に戻っていることを必ず確認する。
--   5. 誰の依頼で・いつ・何を削除したかは、個人情報を含まない形(顧客番号・日付・依頼の種類)で記録する。
