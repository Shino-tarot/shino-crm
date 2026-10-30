-- 既存データをすべて「鯛子(taiko)」のアカウントへ振り分ける
--
-- 【実行状況】検証用DB(shino-crm-test): 実行済み / 本番DB: 未実行
-- 【要承認】既存データの account_id を更新するファイル。実行はオーナーが明示的に指示したタイミングで行うこと
--          (まず検証用DBのみ。実行前にバックアップを取ること)。
-- 前提: 0016_accounts_additive.sql が適用済みであること(accounts に taiko が登録されていること)。
--
-- 背景:
--   運用方針により、既存の顧客データはすべて鯛子のものとして扱う。
--   0016で追加した account_id(NULL)に 'taiko' を設定し、0018で空欄禁止・アカウント分離の制約を追加する。
--
-- 変更内容:
--   1. LINE自動保存の会話履歴の保護トリガー(0012の protect_conversation_message)を修正し、
--      「account_id を空欄から設定するだけ」の更新のみ許可する(本文・日時など他の列の変更は引き続き拒否)
--   2. 8テーブルの account_id が NULL の行に 'taiko' を設定する
--        customers / free_reading_requests / paid_readings / upsell_purchases / customer_records /
--        line_contacts / conversation_messages / customer_merges
--      → 既に account_id が入っている行は変更しない
--      → 振り分けで「最終更新日時(updated_at)」が変わらないよう、この処理の間だけ updated_at の自動更新トリガーを止める
--        (トランザクション内で止めて最後に戻すため、途中で失敗しても自動的に元の状態に戻る)
--
-- このファイルで「しないこと」:
--   - account_id 以外の列は変更しない。行の追加・削除もしない
--   - 空欄禁止・アカウントをまたぐ紐づけの禁止などの制約は追加しない(0018で行う)
--
-- 再実行について:
--   NULLの行だけを更新するため、2回実行しても結果は変わらない。
--   途中で失敗した場合はトランザクションにより全体が取り消される。
--
-- 【実行前の確認】(読み取りのみ。件数を控えておく)
--   select
--     (select count(*) from public.accounts where id = 'taiko') as has_taiko,                  -- 1
--     (select count(*) from public.customers where account_id is null) as customers,
--     (select count(*) from public.free_reading_requests where account_id is null) as requests,
--     (select count(*) from public.paid_readings where account_id is null) as paid_readings,
--     (select count(*) from public.upsell_purchases where account_id is null) as upsell_purchases,
--     (select count(*) from public.customer_records where account_id is null) as customer_records,
--     (select count(*) from public.line_contacts where account_id is null) as line_contacts,
--     (select count(*) from public.conversation_messages where account_id is null) as messages,
--     (select count(*) from public.customer_merges where account_id is null) as merges,
--     (select count(*) from public.customers where account_id is not null and account_id <> 'taiko') as non_taiko_customers;  -- 0
--
-- 実行後の確認(読み取りのみ。SQL Editorは最後の結果しか表示しないため1つの select にまとめている):
--   select
--     -- (a) 振り分けていない行が0件(0 なら成功)
--     (select count(*) from public.customers where account_id is null)
--       + (select count(*) from public.free_reading_requests where account_id is null)
--       + (select count(*) from public.paid_readings where account_id is null)
--       + (select count(*) from public.upsell_purchases where account_id is null)
--       + (select count(*) from public.customer_records where account_id is null)
--       + (select count(*) from public.line_contacts where account_id is null)
--       + (select count(*) from public.conversation_messages where account_id is null)
--       + (select count(*) from public.customer_merges where account_id is null) as rows_without_account,
--     -- (b) updated_at の自動更新トリガーが有効に戻っていること(7 なら成功)
--     (select count(*) from pg_trigger
--      where tgname like '%_set_updated_at' and tgenabled = 'O') as enabled_updated_at_triggers,
--     -- (c) 鯛子以外に振り分けられた行が無いこと(0 なら成功)
--     (select count(*) from public.customers where account_id <> 'taiko') as non_taiko_customers;
--   -- 件数が実行前と同じことは、別途「件数の確認」SQLで比べる
--
-- 元に戻す場合(0018を実行する前に限る。振り分けを取り消し、トリガーを0012の内容に戻す):
--   0018実行前であれば、各テーブルで「update ... set account_id = null」を実行し、
--   protect_conversation_message を 0012_conversation_history.sql の内容で作り直す
--   (LINE自動保存の会話履歴は保護トリガーのため、作り直す前に account_id を戻すこと)。

begin;

-- 前提の確認(taikoが無ければ何もせずに中止する)
do $$
begin
  if not exists (select 1 from public.accounts where id = 'taiko') then
    raise exception '0016が未適用、または accounts に taiko がありません';
  end if;
end;
$$;

-- ============================================================
-- 1. LINE自動保存の会話履歴の保護トリガーを修正
-- ============================================================
-- 0012からの変更点: LINE自動保存の履歴について「account_id を空欄から設定するだけ」の更新を許可する。
-- それ以外(本文・日時・送受信などの変更、account_id の書き換え、削除)は従来どおり拒否する。
create or replace function public.protect_conversation_message()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.source = 'line_webhook' then
      raise exception 'LINEから自動保存した会話履歴は削除できません(id=%)', old.id;
    end if;
    return old;
  end if;

  if old.source = 'line_webhook' then
    if old.account_id is null and new.account_id is not null
       and (to_jsonb(new) - 'account_id' - 'updated_at') = (to_jsonb(old) - 'account_id' - 'updated_at') then
      return new;
    end if;
    raise exception 'LINEから自動保存した会話履歴は変更できません(id=%)', old.id;
  end if;
  if new.source is distinct from old.source then
    raise exception '会話履歴の登録種別は変更できません(id=%)', old.id;
  end if;
  return new;
end;
$$;

-- ============================================================
-- 2. 既存データを鯛子へ振り分ける(account_id が NULL の行のみ)
-- ============================================================
-- 振り分けで最終更新日時が変わらないよう、この間だけ updated_at の自動更新を止める(最後に必ず戻す)
alter table public.customers disable trigger customers_set_updated_at;
alter table public.free_reading_requests disable trigger free_reading_requests_set_updated_at;
alter table public.paid_readings disable trigger paid_readings_set_updated_at;
alter table public.upsell_purchases disable trigger upsell_purchases_set_updated_at;
alter table public.customer_records disable trigger customer_records_set_updated_at;
alter table public.line_contacts disable trigger line_contacts_set_updated_at;
alter table public.conversation_messages disable trigger conversation_messages_set_updated_at;

update public.customers             set account_id = 'taiko' where account_id is null;
update public.free_reading_requests set account_id = 'taiko' where account_id is null;
update public.paid_readings         set account_id = 'taiko' where account_id is null;
update public.upsell_purchases      set account_id = 'taiko' where account_id is null;
update public.customer_records      set account_id = 'taiko' where account_id is null;
update public.line_contacts         set account_id = 'taiko' where account_id is null;
update public.conversation_messages set account_id = 'taiko' where account_id is null;
update public.customer_merges       set account_id = 'taiko' where account_id is null;

alter table public.customers enable trigger customers_set_updated_at;
alter table public.free_reading_requests enable trigger free_reading_requests_set_updated_at;
alter table public.paid_readings enable trigger paid_readings_set_updated_at;
alter table public.upsell_purchases enable trigger upsell_purchases_set_updated_at;
alter table public.customer_records enable trigger customer_records_set_updated_at;
alter table public.line_contacts enable trigger line_contacts_set_updated_at;
alter table public.conversation_messages enable trigger conversation_messages_set_updated_at;

commit;
