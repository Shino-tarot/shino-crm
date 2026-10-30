-- 複数アカウント(鯛子・夜宵)管理のための土台: アカウント一覧と account_id 列の追加
--
-- 【実行状況】検証用DB(shino-crm-test): 実行済み / 本番DB: 未実行
-- 実行はオーナーが明示的に指示したタイミングで行うこと(まず検証用DBのみ)。
-- 前提: 0001〜0015 が適用済みであること。
--
-- 背景:
--   1つのCRMで「鯛子」と「夜宵」を切り替えて管理し、顧客・鑑定・LINE履歴・通知をアカウントごとに完全に分離する。
--   同じ名前・LINE表示名の顧客がいても別々の顧客として扱い、アカウントをまたぐ統合は禁止する。
--   安全のため、次の3段階に分けて進める。
--     0016(このファイル): テーブル・列の「追加のみ」。既存データは一切変更しない
--     0017: 既存データをすべて「鯛子(taiko)」に振り分ける(オーナー承認のうえで実行)。
--           LINE自動保存の会話履歴の保護トリガー(0012)は、account_id を空欄から設定することだけ許可するよう修正する
--     0018: 制約の厳格化(account_id の空欄禁止、アカウントをまたぐ紐づけの禁止、
--           LINE User IDの重複禁止をアカウント単位へ変更、0012のトリガー・0015の統合関数のアカウント対応)
--
-- 変更内容:
--   1. accounts(アカウント一覧)を新設し、taiko(鯛子)・yayoi(夜宵)の2行を登録する
--      → 識別子(id)はURL・コードで使うため、作成後は変更しない
--      → 管理画面・Webhookは service_role 経由のみ読み取る(anon / authenticated からは不可)
--   2. 次の8テーブルに account_id(accounts.id への外部キー)を追加する
--        customers / free_reading_requests / paid_readings / upsell_purchases / customer_records /
--        line_contacts / conversation_messages / customer_merges
--      → NULL許容・既定値なし(既存の行はすべて NULL のまま)
--        既定値を付けないのは、将来アカウントの指定漏れが黙って特定のアカウントに入るのを防ぐため
--      → アカウントは削除・識別子の変更ができない(on delete / on update restrict)
--      → status_auto_updates(申込に必ず紐づく内部記録)・crm_feature_launches(CRM全体の設定)は対象外
--
-- このファイルで「しないこと」:
--   - 既存の行・値は一切変更・削除しない(既存テーブルへの UPDATE / DELETE を含まない)
--   - 既存の制約・トリガー・関数・権限は変更しない
--   - 既存データのアカウント振り分け・空欄禁止などの制約の厳格化は行わない(0017・0018で行う)
--   このファイルを実行しても、アプリの動作は変わらない(アプリはまだ account_id を参照しないため)。
--   ※ 0016適用後〜0017までに登録されたデータも account_id は NULL になる。
--     その間は鯛子のデータのみが登録される前提のため、アプリのアカウント対応が終わるまで夜宵の運用は始めないこと。
--
-- 再実行について:
--   「if not exists」「on conflict do nothing」で書いており、2回実行しても結果は変わらない。
--   途中で失敗した場合はトランザクションにより全体が取り消される。
--
-- 【実行前の確認】(読み取りのみ。想定と違う場合は実行せずに相談すること)
--   select
--     (to_regprocedure('public.merge_customers(uuid, uuid, uuid)') is not null) as has_0015,   -- true
--     (to_regclass('public.accounts') is not null) as already_has_accounts,                     -- false
--     (select count(*) from information_schema.columns
--      where table_schema = 'public' and column_name = 'account_id') as account_id_columns,   -- 0
--     (select count(*) from public.customers) as customers_total;                              -- 値を控える
--
-- 実行後の確認(読み取りのみ):
--   select
--     (select string_agg(id || '=' || display_name, ', ' order by sort_order) from public.accounts) as accounts,  -- taiko=鯛子, yayoi=夜宵
--     (select count(*) from information_schema.columns
--      where table_schema = 'public' and column_name = 'account_id') as account_id_columns,   -- 8
--     (select count(*) from public.customers where account_id is not null)
--       + (select count(*) from public.free_reading_requests where account_id is not null)
--       + (select count(*) from public.paid_readings where account_id is not null)
--       + (select count(*) from public.upsell_purchases where account_id is not null)
--       + (select count(*) from public.customer_records where account_id is not null)
--       + (select count(*) from public.line_contacts where account_id is not null)
--       + (select count(*) from public.conversation_messages where account_id is not null)
--       + (select count(*) from public.customer_merges where account_id is not null) as rows_with_account,  -- 0
--     has_table_privilege('service_role', 'public.accounts', 'SELECT') as service_role_can_read_accounts,  -- true
--     has_table_privilege('anon', 'public.accounts', 'SELECT') as anon_can_read_accounts,                  -- false
--     has_table_privilege('authenticated', 'public.accounts', 'SELECT') as authenticated_can_read_accounts, -- false
--     (select count(*) from public.customers) as customers_total;                                          -- 実行前と同じ
--
-- 元に戻す場合(このファイルの変更のみを取り消す。0017を実行する前に限る):
--   alter table public.customer_merges       drop column if exists account_id;
--   alter table public.conversation_messages drop column if exists account_id;
--   alter table public.line_contacts         drop column if exists account_id;
--   alter table public.customer_records      drop column if exists account_id;
--   alter table public.upsell_purchases      drop column if exists account_id;
--   alter table public.paid_readings         drop column if exists account_id;
--   alter table public.free_reading_requests drop column if exists account_id;
--   alter table public.customers             drop column if exists account_id;
--   drop table if exists public.accounts;

begin;

-- ============================================================
-- 1. アカウント一覧
-- ============================================================
create table if not exists public.accounts (
  -- URL・コードで使う識別子(例: taiko / yayoi)。作成後は変更しない
  id text primary key check (id ~ '^[a-z][a-z0-9_]{1,31}$'),
  display_name text not null,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.accounts is
  'CRMで切り替えて管理するアカウント(鯛子・夜宵など)。顧客データはアカウントごとに完全に分離する';
comment on column public.accounts.id is 'アカウントの識別子(URL・コードで使用。作成後は変更しない)';
comment on column public.accounts.display_name is '画面に表示するアカウント名';

-- 既に登録済みの場合は何もしない(表示名なども上書きしない)
insert into public.accounts (id, display_name, sort_order)
values ('taiko', '鯛子', 1), ('yayoi', '夜宵', 2)
on conflict (id) do nothing;

-- RLS: 既存テーブルと同じ方針(service_role経由のみ、anon / authenticated からは一切アクセス不可)
alter table public.accounts enable row level security;
revoke all on table public.accounts from public, anon, authenticated;
grant select on table public.accounts to service_role;

-- ============================================================
-- 2. 各テーブルに account_id(NULL許容・既定値なし。既存の行はNULLのまま)
-- ============================================================
alter table public.customers
  add column if not exists account_id text null
    references public.accounts(id) on update restrict on delete restrict;

alter table public.free_reading_requests
  add column if not exists account_id text null
    references public.accounts(id) on update restrict on delete restrict;

alter table public.paid_readings
  add column if not exists account_id text null
    references public.accounts(id) on update restrict on delete restrict;

alter table public.upsell_purchases
  add column if not exists account_id text null
    references public.accounts(id) on update restrict on delete restrict;

alter table public.customer_records
  add column if not exists account_id text null
    references public.accounts(id) on update restrict on delete restrict;

alter table public.line_contacts
  add column if not exists account_id text null
    references public.accounts(id) on update restrict on delete restrict;

alter table public.conversation_messages
  add column if not exists account_id text null
    references public.accounts(id) on update restrict on delete restrict;

alter table public.customer_merges
  add column if not exists account_id text null
    references public.accounts(id) on update restrict on delete restrict;

comment on column public.customers.account_id is 'この顧客のアカウント(accounts.id)。0017で既存データを振り分け、0018で必須にする';
comment on column public.free_reading_requests.account_id is 'この申込のアカウント(accounts.id)';
comment on column public.paid_readings.account_id is 'この有料鑑定のアカウント(accounts.id)。顧客のアカウントと一致させる(0018で強制)';
comment on column public.upsell_purchases.account_id is 'このアップセルのアカウント(accounts.id)。顧客のアカウントと一致させる(0018で強制)';
comment on column public.customer_records.account_id is 'この記録のアカウント(accounts.id)。顧客のアカウントと一致させる(0018で強制)';
comment on column public.line_contacts.account_id is 'このLINE送信者がやり取りしている公式アカウント(accounts.id)';
comment on column public.conversation_messages.account_id is 'この会話履歴のアカウント(accounts.id)';
comment on column public.customer_merges.account_id is 'この統合を行ったアカウント(accounts.id)';

commit;
