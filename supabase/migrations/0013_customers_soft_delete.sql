-- 顧客の論理削除(非表示)・復元のためのDB変更
--
-- 【実行状況】検証用DB(shino-crm-test): 実行済み / 本番DB: 未実行
-- 実行はオーナーが明示的に指示したタイミングで行うこと(まず検証用DBのみ)。
--
-- 背景:
--   現在の顧客削除(src/lib/customers/actions.ts の deleteCustomer)は customers の行を物理削除するため、
--   外部キーの設定により次のデータが連動して失われる/紐づけが外れる。
--     - customer_records         : on delete cascade  → 完全に削除される
--     - paid_readings            : on delete cascade  → 完全に削除される
--     - upsell_purchases         : on delete cascade  → 完全に削除される
--     - conversation_messages    : on delete cascade  → 手動登録の会話履歴が完全に削除される
--     - free_reading_requests    : on delete set null → 申込は残るが顧客との紐づけが外れる
--     - line_contacts            : on delete set null → LINE送信者は残るが未紐づけに戻る
--   顧客管理への統合に向けて、削除を「非表示(deleted_atをセット)」に置き換え、後から復元できるようにする。
--
-- 変更内容:
--   1. customers に deleted_at(非表示にした日時)・deleted_by(操作したスタッフ)を追加
--   2. 表示中の顧客一覧用の部分インデックスを追加
--
-- このファイルで「しないこと」:
--   - 既存の行・値は一切変更・削除しない(UPDATE/DELETEを含まない)。追加カラムはNULL許容でデフォルト値なし
--     → 既存の顧客はすべて deleted_at = NULL(=表示中)のまま
--   - 外部キー(on delete cascade / set null)は変更しない
--   - 物理削除の禁止(トリガー)はまだ追加しない
--     → アプリの削除ボタンを「非表示」に切り替えた後、別のマイグレーションで追加する
--       (先に追加すると、現在の削除ボタンがエラーになるため)
--   このファイルを実行しても、アプリの動作(削除ボタン・一覧・検索・集計)は変わらない
--   (アプリはまだ deleted_at を参照しないため)。
--
-- 再実行について:
--   「if not exists」で書いており、2回実行しても結果は変わらない。
--   途中で失敗した場合はトランザクションにより全体が取り消される。
--
-- 実行後の確認(読み取りのみ):
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'customers'
--     and column_name in ('deleted_at', 'deleted_by');
--   -- 非表示の顧客が0件であること(実行直後は必ず0件)
--   select count(*) from public.customers where deleted_at is not null;
--
-- 元に戻す場合(このファイルの変更のみを取り消す。非表示機能の利用開始前に限る):
--   drop index if exists public.customers_active_created_at_idx;
--   alter table public.customers drop column if exists deleted_by;
--   alter table public.customers drop column if exists deleted_at;

begin;

-- ============================================================
-- 1. 非表示(論理削除)用のカラム
-- ============================================================
alter table public.customers
  add column if not exists deleted_at timestamptz null;

-- 操作したスタッフ(auth.users.id)。line_contacts.linked_by等と同じく外部キーは張らない
alter table public.customers
  add column if not exists deleted_by uuid null;

comment on column public.customers.deleted_at is
  '非表示にした日時(論理削除)。NULL=表示中。非表示でも関連データ(申込・購入・LINE紐づけ・会話履歴)は保持し、NULLに戻せば復元できる';
comment on column public.customers.deleted_by is
  '非表示にしたスタッフ(auth.users.id)。復元時はNULLに戻す';

-- ============================================================
-- 2. 表示中の顧客一覧用(listCustomersの created_at 降順に合わせる)
-- ============================================================
create index if not exists customers_active_created_at_idx
  on public.customers (created_at desc)
  where deleted_at is null;

commit;
