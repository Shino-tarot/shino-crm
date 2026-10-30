-- 0017の前のバックアップ(検証用DB shino-crm-test 専用)
-- 既存のテーブルは変更しない。別のスキーマ backup_before_0017 に、8テーブルの現在の内容をコピーするだけ。
-- このスキーマはAPI(PostgREST)からは見えない(公開されるのは public スキーマのみ)。
-- 0017で変わるのは account_id(空欄→taiko)だけのため、万一の時はこのコピーと比べて確認・復元できる。
-- 既にバックアップがある場合は何もしない(最初に取ったバックアップを上書きしない。2回実行してもエラーにならない)。
begin;
create schema if not exists backup_before_0017;
revoke all on schema backup_before_0017 from public, anon, authenticated;
create table if not exists backup_before_0017.customers             as table public.customers;
create table if not exists backup_before_0017.free_reading_requests as table public.free_reading_requests;
create table if not exists backup_before_0017.paid_readings         as table public.paid_readings;
create table if not exists backup_before_0017.upsell_purchases      as table public.upsell_purchases;
create table if not exists backup_before_0017.customer_records      as table public.customer_records;
create table if not exists backup_before_0017.line_contacts         as table public.line_contacts;
create table if not exists backup_before_0017.conversation_messages as table public.conversation_messages;
create table if not exists backup_before_0017.customer_merges       as table public.customer_merges;
commit;
