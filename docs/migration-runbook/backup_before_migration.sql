-- 本番移行前のバックアップ(既存のテーブルは変更しない。別のスキーマにコピーするだけ)
-- Supabaseの管理画面のバックアップ(Database > Backups)に加えて、すぐ確認・比較できる控えとして作る。
-- 存在するテーブルだけをコピーする。既にバックアップがある場合は何もしない(上書きしない)。
-- このスキーマはAPI(PostgREST)からは見えない(公開されるのは public スキーマのみ)。
do $$
declare
  t text;
begin
  create schema if not exists backup_before_prod_migration;
  revoke all on schema backup_before_prod_migration from public, anon, authenticated;
  foreach t in array array[
    'customers', 'customer_records', 'free_reading_requests', 'paid_readings', 'upsell_purchases',
    'status_auto_updates', 'line_contacts', 'conversation_messages', 'customer_merges'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('create table if not exists backup_before_prod_migration.%I as table public.%I', t, t);
    end if;
  end loop;
end;
$$;
