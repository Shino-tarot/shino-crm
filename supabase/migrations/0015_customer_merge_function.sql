-- 顧客統合(「同じ顧客として紐付ける」)を1つのトランザクションで安全に行うためのDB変更
--
-- 【実行状況】検証用DB(shino-crm-test): 実行済み / 本番DB: 未実行
-- 実行はオーナーが明示的に指示したタイミングで行うこと(まず検証用DBのみ)。
-- 前提: 0012(会話履歴・LINE送信者)、0013(顧客の非表示)、0014(顧客の物理削除禁止)が適用済みであること。
--
-- 背景:
--   これまでの統合処理(src/lib/customers/linking.ts)は、アプリから3つの更新を別々に送っていたため、
--   途中で失敗すると一部だけ移った状態になりえた。また、手動の会話履歴・過去の記録(customer_records)・
--   LINE送信者の紐づけは統合先へ移らず、統合元の顧客も一覧に残っていた。
--
-- 変更内容:
--   1. customers に統合先(merged_into_customer_id)・統合日時(merged_at)を追加
--      → 統合された顧客は「非表示のまま」でなければならない(CHECK制約)。統合済みの顧客を誤って復元できない
--   2. 統合の記録テーブル customer_merges を新設(誰が・いつ・何件移したか。元に戻す際の手がかり)
--   3. 統合関数 merge_customers(統合元, 統合先, 操作したスタッフ) を新設
--      → 申込・有料鑑定・アップセル・過去の記録・手動の会話履歴・LINE送信者の紐づけを統合先へ移し、
--        すべて成功した場合のみ統合元を非表示にして統合先を記録する
--      → 関数1回の呼び出しが1つのトランザクションになり、途中で失敗した場合はすべて元に戻る
--      → LINE紐づけの競合(両方に別のLINE送信者が紐づいている・LINE User IDが食い違う)があれば、
--        何も変更せずにエラーにする
--      → 顧客の基本情報(名前・生年月日など)は変更しない。
--        例外として、LINE紐づけをDBの整合性チェック(0012のトリガー)に通すため、
--        統合元のLINE User IDは空にし、統合先のLINE User IDが空の場合のみその値を入れる
--        (統合先に値がある場合は変更しない。統合元の元の値は customer_merges に記録する)
--   4. 関数・記録テーブルは service_role のみ利用可能にする(anon / authenticated / public からは不可)
--      → アプリでは、ログイン済み管理者を確認したServer Actionからのみ呼び出す
--
-- このファイルで「しないこと」:
--   - 既存の行・値は一切変更・削除しない(この関数を「呼び出したとき」だけ統合が行われる)
--   - 顧客の物理削除は行わない(0014の削除禁止トリガーはそのまま)
--   - LINEから自動保存した会話履歴(source='line_webhook')は変更しない
--     (LINE送信者に紐づいているため、LINE送信者の紐づけを移せば統合先に表示される)
--
-- 再実行について:
--   「if not exists」「create or replace」「drop ... if exists → add」で書いており、
--   2回実行しても結果は変わらない。途中で失敗した場合はトランザクションにより全体が取り消される。
--
-- 実行後の確認(読み取りのみ):
--   -- (a) 追加したカラム(2行表示されれば成功)
--   select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'customers'
--     and column_name in ('merged_into_customer_id', 'merged_at');
--   -- (b) 統合の記録テーブル(0件であること)
--   select count(*) from public.customer_merges;
--   -- (c) 関数を実行できるのが service_role だけであること(service_role だけ true なら成功)
--   select
--     has_function_privilege('service_role', 'public.merge_customers(uuid, uuid, uuid)', 'EXECUTE') as service_role,
--     has_function_privilege('anon', 'public.merge_customers(uuid, uuid, uuid)', 'EXECUTE') as anon,
--     has_function_privilege('authenticated', 'public.merge_customers(uuid, uuid, uuid)', 'EXECUTE') as authenticated;
--   -- (d) 既存の顧客はすべて未統合であること(0件であること)
--   select count(*) from public.customers where merged_into_customer_id is not null;
--
-- 元に戻す場合(このファイルの変更のみを取り消す。統合機能の利用開始前に限る):
--   drop function if exists public.merge_customers(uuid, uuid, uuid);
--   drop table if exists public.customer_merges;
--   alter table public.customers drop constraint if exists customers_merged_must_be_hidden_check;
--   alter table public.customers drop constraint if exists customers_merged_into_not_self_check;
--   alter table public.customers drop column if exists merged_at;
--   alter table public.customers drop column if exists merged_into_customer_id;

begin;

-- ============================================================
-- 1. 統合先・統合日時
-- ============================================================
alter table public.customers
  add column if not exists merged_into_customer_id uuid null
    references public.customers(id) on delete restrict;

alter table public.customers
  add column if not exists merged_at timestamptz null;

comment on column public.customers.merged_into_customer_id is
  'この顧客の統合先(customers.id)。NULL=未統合。統合された顧客は非表示(deleted_atあり)のまま保持する';
comment on column public.customers.merged_at is '統合した日時';

-- 自分自身を統合先にしない
alter table public.customers
  drop constraint if exists customers_merged_into_not_self_check;
alter table public.customers
  add constraint customers_merged_into_not_self_check
    check (merged_into_customer_id is null or merged_into_customer_id <> id);

-- 統合された顧客は非表示のまま(復元すると中身が空の顧客が一覧に戻ってしまうため)
alter table public.customers
  drop constraint if exists customers_merged_must_be_hidden_check;
alter table public.customers
  add constraint customers_merged_must_be_hidden_check
    check (merged_into_customer_id is null or deleted_at is not null);

-- ============================================================
-- 2. 統合の記録
-- ============================================================
create table if not exists public.customer_merges (
  id uuid primary key default gen_random_uuid(),
  source_customer_id uuid not null references public.customers(id) on delete restrict,
  target_customer_id uuid not null references public.customers(id) on delete restrict,
  -- 操作したスタッフ(auth.users.id)
  merged_by uuid null,
  -- 移した件数(requests / paid_readings / upsell_purchases / customer_records / manual_messages / line_contact)
  moved_counts jsonb not null,
  -- 移したLINE送信者(line_contacts.id)。移していなければNULL
  moved_line_contact_id uuid null,
  -- 統合元に入っていたLINE User ID(統合時に空にするため、元の値を記録しておく)。無ければNULL
  source_line_user_id text null,
  -- 統合先のLINE User IDを空から設定した場合 true
  target_line_user_id_filled boolean not null default false,
  created_at timestamptz not null default now(),
  constraint customer_merges_distinct_check check (source_customer_id <> target_customer_id)
);

comment on table public.customer_merges is
  '顧客統合の記録(merge_customersが1回成功するごとに1行)。誤統合の調査・手動での切り戻しの手がかり';

create index if not exists customer_merges_target_idx
  on public.customer_merges (target_customer_id);

-- ============================================================
-- 3. 統合関数
-- ============================================================
-- 呼び出し元の権限で動く(security invoker)。service_role は対象テーブルの更新権限を持つ。
-- エラーは 'MERGE_' で始まる固定のコード文字列のみで返す(個人情報・IDを含めない)。
create or replace function public.merge_customers(
  p_source_customer_id uuid,
  p_target_customer_id uuid,
  p_staff_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_source public.customers%rowtype;
  v_target public.customers%rowtype;
  v_source_contact public.line_contacts%rowtype;
  v_target_contact public.line_contacts%rowtype;
  v_source_line_user_id text;
  v_target_line_user_id text;
  v_target_filled boolean := false;
  v_requests integer := 0;
  v_paid_readings integer := 0;
  v_upsell_purchases integer := 0;
  v_customer_records integer := 0;
  v_manual_messages integer := 0;
  v_counts jsonb;
begin
  if p_source_customer_id is null or p_target_customer_id is null then
    raise exception 'MERGE_INVALID_ARGUMENT';
  end if;
  if p_source_customer_id = p_target_customer_id then
    raise exception 'MERGE_SAME_CUSTOMER';
  end if;

  -- 同じ顧客への統合・非表示・復元が同時に行われないよう、2人の顧客をid順にロックする
  perform 1 from public.customers
  where id in (p_source_customer_id, p_target_customer_id)
  order by id
  for update;

  select * into v_source from public.customers where id = p_source_customer_id;
  if not found then
    raise exception 'MERGE_CUSTOMER_NOT_FOUND';
  end if;
  select * into v_target from public.customers where id = p_target_customer_id;
  if not found then
    raise exception 'MERGE_CUSTOMER_NOT_FOUND';
  end if;

  -- 非表示中(統合済みを含む)の顧客は統合しない
  if v_source.deleted_at is not null or v_target.deleted_at is not null
     or v_source.merged_into_customer_id is not null
     or v_target.merged_into_customer_id is not null then
    raise exception 'MERGE_CUSTOMER_HIDDEN';
  end if;

  -- ---------- LINE紐づけの競合確認(競合があれば何も変更せずにエラー) ----------
  select * into v_source_contact from public.line_contacts
  where customer_id = p_source_customer_id
  for update;
  select * into v_target_contact from public.line_contacts
  where customer_id = p_target_customer_id
  for update;

  v_source_line_user_id := btrim(coalesce(v_source.line_user_id, ''));
  v_target_line_user_id := btrim(coalesce(v_target.line_user_id, ''));

  -- 1人の顧客に紐づけられるLINE送信者は1件まで(0012)のため、両方に紐づいている場合は統合できない
  if v_source_contact.id is not null and v_target_contact.id is not null then
    raise exception 'MERGE_LINE_BOTH_LINKED';
  end if;

  -- LINE User IDが食い違う(=別のLINEアカウントの可能性がある)場合は統合しない
  if (v_source_line_user_id <> '' and v_target_line_user_id <> ''
        and v_source_line_user_id <> v_target_line_user_id)
     or (v_source_contact.id is not null and v_target_line_user_id <> ''
        and v_target_line_user_id <> v_source_contact.line_user_id)
     or (v_target_contact.id is not null and v_source_line_user_id <> ''
        and v_source_line_user_id <> v_target_contact.line_user_id)
     or (v_source_contact.id is not null and v_source_line_user_id <> ''
        and v_source_line_user_id <> v_source_contact.line_user_id) then
    raise exception 'MERGE_LINE_USER_ID_CONFLICT';
  end if;

  -- ---------- LINE紐づけの引き継ぎ(0012のトリガーに通る順番で行う) ----------
  -- (1) 統合元のLINE User IDを空にする(元の値は記録テーブルに残す)
  if v_source_line_user_id <> '' then
    update public.customers set line_user_id = '' where id = p_source_customer_id;
  end if;

  -- (2) 統合元に紐づくLINE送信者を統合先へ移す(LINEから自動保存した会話履歴は送信者経由で統合先に表示される)
  if v_source_contact.id is not null then
    update public.line_contacts
    set customer_id = p_target_customer_id, linked_at = now(), linked_by = p_staff_id
    where id = v_source_contact.id;
  end if;

  -- (3) 統合先のLINE User IDが空の場合のみ、統合元の値を入れる(既にある値は上書きしない)
  if v_source_line_user_id <> '' and v_target_line_user_id = '' then
    update public.customers set line_user_id = v_source_line_user_id where id = p_target_customer_id;
    v_target_filled := true;
  end if;

  -- ---------- 関連データの付け替え(削除済み・論理削除済みのものも含めてすべて移す) ----------
  update public.free_reading_requests set customer_id = p_target_customer_id
  where customer_id = p_source_customer_id;
  get diagnostics v_requests = row_count;

  update public.paid_readings set customer_id = p_target_customer_id
  where customer_id = p_source_customer_id;
  get diagnostics v_paid_readings = row_count;

  update public.upsell_purchases set customer_id = p_target_customer_id
  where customer_id = p_source_customer_id;
  get diagnostics v_upsell_purchases = row_count;

  update public.customer_records set customer_id = p_target_customer_id
  where customer_id = p_source_customer_id;
  get diagnostics v_customer_records = row_count;

  -- 手動登録の会話履歴のみ(LINE自動保存分は customer_id を持たない)
  update public.conversation_messages set customer_id = p_target_customer_id
  where customer_id = p_source_customer_id and source = 'manual';
  get diagnostics v_manual_messages = row_count;

  -- ---------- すべて成功した場合のみ、統合元を非表示にして統合先を記録する ----------
  update public.customers
  set deleted_at = now(),
      deleted_by = p_staff_id,
      merged_into_customer_id = p_target_customer_id,
      merged_at = now()
  where id = p_source_customer_id;

  v_counts := jsonb_build_object(
    'requests', v_requests,
    'paid_readings', v_paid_readings,
    'upsell_purchases', v_upsell_purchases,
    'customer_records', v_customer_records,
    'manual_messages', v_manual_messages,
    'line_contact', v_source_contact.id is not null
  );

  insert into public.customer_merges (
    source_customer_id, target_customer_id, merged_by, moved_counts,
    moved_line_contact_id, source_line_user_id, target_line_user_id_filled
  ) values (
    p_source_customer_id, p_target_customer_id, p_staff_id, v_counts,
    v_source_contact.id, nullif(v_source_line_user_id, ''), v_target_filled
  );

  return v_counts;
end;
$$;

comment on function public.merge_customers(uuid, uuid, uuid) is
  '顧客統合(統合元のデータを統合先へ移し、統合元を非表示にする)。service_roleのみ実行可。1回の呼び出しが1トランザクション';

-- ============================================================
-- 4. 権限(service_role のみ。一般公開しない)
-- ============================================================
-- 関数は作成時に PUBLIC へ実行権限が付き、Supabaseでは anon / authenticated にも自動付与されるため、明示的に取り消す
revoke all on function public.merge_customers(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.merge_customers(uuid, uuid, uuid) to service_role;

alter table public.customer_merges enable row level security;
revoke all on table public.customer_merges from public, anon, authenticated;
grant select, insert on table public.customer_merges to service_role;
-- anon / authenticated へのポリシーは意図的に作成しない

commit;
