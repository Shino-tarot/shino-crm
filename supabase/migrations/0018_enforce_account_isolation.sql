-- アカウント(鯛子・夜宵)ごとのデータ分離をDBで強制する
--
-- 【実行状況】検証用DB(shino-crm-test): 実行済み / 本番DB: 未実行
-- 実行はオーナーが明示的に指示したタイミングで行うこと(まず検証用DBのみ)。
-- 前提: 0017_assign_existing_data_to_taiko.sql が適用済みで、account_id が NULL の行が無いこと
--       (NULLの行が残っていると、1. の空欄禁止で失敗し、全体が取り消される)。
-- 前提(アプリ): アカウント対応済みのアプリ(account_id を必ず指定して保存する版)に切り替えてから実行すること。
--       旧アプリのままだと、account_id を指定しない保存(顧客・申込・LINE受信など)が空欄禁止で失敗する。
--
-- 変更内容:
--   1. 8テーブルの account_id を空欄禁止にする
--   2. アカウントをまたぐ紐づけを禁止する(複合外部キー)
--      → 有料鑑定・アップセル・記録・申込・LINE送信者・会話履歴・統合の記録・統合先は、
--        紐づく顧客(またはLINE送信者)と同じアカウントでなければ保存できない
--   3. account_id の変更を禁止する(一度決まったアカウントは変えられない)
--   4. LINE User IDの重複禁止を「CRM全体」から「アカウントごと」に変更する
--      (鯛子と夜宵で同じLINE User IDが現れても、別々の送信者・顧客として扱う)
--   5. 0012のLINE紐づけチェック(トリガー)を、同じアカウントの中だけで照合するように変更する
--   6. 0015の統合関数を置き換える
--      → アカウントが違う顧客どうしは統合しない(MERGE_CROSS_ACCOUNT)
--      → 生年月日が違う場合は原則統合しない。理由(p_reason)が入力された場合のみ統合し、理由を記録する
--        (生年月日 = 顧客の birthday、無ければその顧客の最新の申込の birth_date)
--   7. アカウントでの絞り込み用の索引を追加する
--
-- このファイルで「しないこと」:
--   - 既存の行・値は一切変更・削除しない(既存テーブルへの UPDATE / DELETE を含まない)
--   - 既存の外部キー(on delete cascade / set null)は残す(複合外部キーを追加で張る)
--   - 0014の削除防止はそのまま
--
-- 再実行について:
--   「drop ... if exists → add」「create or replace」「if not exists」で書いており、2回実行しても結果は変わらない。
--   途中で失敗した場合はトランザクションにより全体が取り消される。
--
-- 【実行前の確認】(読み取りのみ。想定と違う場合は実行せずに相談すること)
--   select
--     (select count(*) from public.customers where account_id is null)
--       + (select count(*) from public.free_reading_requests where account_id is null)
--       + (select count(*) from public.paid_readings where account_id is null)
--       + (select count(*) from public.upsell_purchases where account_id is null)
--       + (select count(*) from public.customer_records where account_id is null)
--       + (select count(*) from public.line_contacts where account_id is null)
--       + (select count(*) from public.conversation_messages where account_id is null)
--       + (select count(*) from public.customer_merges where account_id is null) as rows_without_account,  -- 0
--     -- 紐づく顧客とアカウントが違う行(すべて 0)
--     (select count(*) from public.paid_readings p join public.customers c on c.id = p.customer_id where p.account_id <> c.account_id)
--       + (select count(*) from public.upsell_purchases p join public.customers c on c.id = p.customer_id where p.account_id <> c.account_id)
--       + (select count(*) from public.customer_records p join public.customers c on c.id = p.customer_id where p.account_id <> c.account_id)
--       + (select count(*) from public.free_reading_requests p join public.customers c on c.id = p.customer_id where p.account_id <> c.account_id)
--       + (select count(*) from public.line_contacts p join public.customers c on c.id = p.customer_id where p.account_id <> c.account_id)
--       + (select count(*) from public.conversation_messages p join public.customers c on c.id = p.customer_id where p.account_id <> c.account_id)
--       + (select count(*) from public.conversation_messages p join public.line_contacts l on l.id = p.line_contact_id where p.account_id <> l.account_id)
--       as cross_account_rows;
--
-- 実行後の確認(読み取りのみ):
--   select
--     (select count(*) from information_schema.columns
--      where table_schema = 'public' and column_name = 'account_id' and is_nullable = 'NO') as required_account_columns,  -- 8
--     (select count(*) from pg_constraint where contype = 'f' and conname in (
--        'free_reading_requests_account_customer_fkey', 'paid_readings_account_customer_fkey',
--        'upsell_purchases_account_customer_fkey', 'customer_records_account_customer_fkey',
--        'line_contacts_account_customer_fkey', 'conversation_messages_account_customer_fkey',
--        'conversation_messages_account_line_contact_fkey', 'customer_merges_account_source_fkey',
--        'customer_merges_account_target_fkey', 'customers_account_merged_into_fkey')) as account_fkeys,      -- 10
--     (select count(*) from pg_trigger where tgname like '%_prevent_account_change') as account_change_guards,          -- 8
--     has_function_privilege('service_role', 'public.merge_customers(uuid, uuid, uuid, text)', 'EXECUTE') as fn_service_role,  -- true
--     has_function_privilege('anon', 'public.merge_customers(uuid, uuid, uuid, text)', 'EXECUTE') as fn_anon,                  -- false
--     has_function_privilege('authenticated', 'public.merge_customers(uuid, uuid, uuid, text)', 'EXECUTE') as fn_authenticated, -- false
--     (to_regprocedure('public.merge_customers(uuid, uuid, uuid)') is null) as old_merge_removed,                         -- true
--     has_table_privilege('service_role', 'public.customers', 'DELETE') as service_role_can_delete,                      -- false(0014維持)
--     (select count(*) from public.customers) as customers_total;                                                         -- 実行前と同じ
--
-- 元に戻す場合: 制約の追加が中心のため、問題が出た場合は実行前のバックアップからの復元、
--   または追加した制約・トリガーの削除で戻す(手順はオーナーと相談のうえで行う)。

begin;

-- ============================================================
-- 1. account_id を空欄禁止にする
-- ============================================================
alter table public.customers             alter column account_id set not null;
alter table public.free_reading_requests alter column account_id set not null;
alter table public.paid_readings         alter column account_id set not null;
alter table public.upsell_purchases      alter column account_id set not null;
alter table public.customer_records      alter column account_id set not null;
alter table public.line_contacts         alter column account_id set not null;
alter table public.conversation_messages alter column account_id set not null;
alter table public.customer_merges       alter column account_id set not null;

-- ============================================================
-- 2. アカウントをまたぐ紐づけの禁止(複合外部キー)
-- ============================================================
-- 再実行に備え、参照する側の外部キーを先に外してから、参照される側のUNIQUEを作り直す
alter table public.free_reading_requests drop constraint if exists free_reading_requests_account_customer_fkey;
alter table public.paid_readings         drop constraint if exists paid_readings_account_customer_fkey;
alter table public.upsell_purchases      drop constraint if exists upsell_purchases_account_customer_fkey;
alter table public.customer_records      drop constraint if exists customer_records_account_customer_fkey;
alter table public.line_contacts         drop constraint if exists line_contacts_account_customer_fkey;
alter table public.conversation_messages drop constraint if exists conversation_messages_account_customer_fkey;
alter table public.conversation_messages drop constraint if exists conversation_messages_account_line_contact_fkey;
alter table public.customer_merges       drop constraint if exists customer_merges_account_source_fkey;
alter table public.customer_merges       drop constraint if exists customer_merges_account_target_fkey;
alter table public.customers             drop constraint if exists customers_account_merged_into_fkey;

alter table public.customers drop constraint if exists customers_account_id_id_key;
alter table public.customers add constraint customers_account_id_id_key unique (account_id, id);
alter table public.line_contacts drop constraint if exists line_contacts_account_id_id_key;
alter table public.line_contacts add constraint line_contacts_account_id_id_key unique (account_id, id);

-- 顧客(またはLINE送信者)が未設定(NULL)の行は確認しない(MATCH SIMPLE)。顧客の削除は0014で禁止済み
alter table public.free_reading_requests add constraint free_reading_requests_account_customer_fkey
  foreign key (account_id, customer_id) references public.customers (account_id, id);
alter table public.paid_readings add constraint paid_readings_account_customer_fkey
  foreign key (account_id, customer_id) references public.customers (account_id, id);
alter table public.upsell_purchases add constraint upsell_purchases_account_customer_fkey
  foreign key (account_id, customer_id) references public.customers (account_id, id);
alter table public.customer_records add constraint customer_records_account_customer_fkey
  foreign key (account_id, customer_id) references public.customers (account_id, id);
alter table public.line_contacts add constraint line_contacts_account_customer_fkey
  foreign key (account_id, customer_id) references public.customers (account_id, id);
alter table public.conversation_messages add constraint conversation_messages_account_customer_fkey
  foreign key (account_id, customer_id) references public.customers (account_id, id);
alter table public.conversation_messages add constraint conversation_messages_account_line_contact_fkey
  foreign key (account_id, line_contact_id) references public.line_contacts (account_id, id);
alter table public.customer_merges add constraint customer_merges_account_source_fkey
  foreign key (account_id, source_customer_id) references public.customers (account_id, id);
alter table public.customer_merges add constraint customer_merges_account_target_fkey
  foreign key (account_id, target_customer_id) references public.customers (account_id, id);
alter table public.customers add constraint customers_account_merged_into_fkey
  foreign key (account_id, merged_into_customer_id) references public.customers (account_id, id);

-- ============================================================
-- 3. account_id の変更禁止
-- ============================================================
create or replace function public.prevent_account_id_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.account_id is not null and new.account_id is distinct from old.account_id then
    raise exception 'ACCOUNT_ID_IMMUTABLE: アカウントは変更できません(table=%)', tg_table_name;
  end if;
  return new;
end;
$$;

revoke execute on function public.prevent_account_id_change() from public, anon, authenticated, service_role;

drop trigger if exists customers_prevent_account_change on public.customers;
create trigger customers_prevent_account_change before update of account_id on public.customers
  for each row execute function public.prevent_account_id_change();
drop trigger if exists free_reading_requests_prevent_account_change on public.free_reading_requests;
create trigger free_reading_requests_prevent_account_change before update of account_id on public.free_reading_requests
  for each row execute function public.prevent_account_id_change();
drop trigger if exists paid_readings_prevent_account_change on public.paid_readings;
create trigger paid_readings_prevent_account_change before update of account_id on public.paid_readings
  for each row execute function public.prevent_account_id_change();
drop trigger if exists upsell_purchases_prevent_account_change on public.upsell_purchases;
create trigger upsell_purchases_prevent_account_change before update of account_id on public.upsell_purchases
  for each row execute function public.prevent_account_id_change();
drop trigger if exists customer_records_prevent_account_change on public.customer_records;
create trigger customer_records_prevent_account_change before update of account_id on public.customer_records
  for each row execute function public.prevent_account_id_change();
drop trigger if exists line_contacts_prevent_account_change on public.line_contacts;
create trigger line_contacts_prevent_account_change before update of account_id on public.line_contacts
  for each row execute function public.prevent_account_id_change();
drop trigger if exists conversation_messages_prevent_account_change on public.conversation_messages;
create trigger conversation_messages_prevent_account_change before update of account_id on public.conversation_messages
  for each row execute function public.prevent_account_id_change();
drop trigger if exists customer_merges_prevent_account_change on public.customer_merges;
create trigger customer_merges_prevent_account_change before update of account_id on public.customer_merges
  for each row execute function public.prevent_account_id_change();

-- ============================================================
-- 4. LINE User IDの重複禁止をアカウントごとに変更する
-- ============================================================
-- LINE送信者: 0012の「CRM全体で1つ」(line_contacts_line_user_id_key)→「アカウント内で1つ」
alter table public.line_contacts drop constraint if exists line_contacts_line_user_id_key;
alter table public.line_contacts drop constraint if exists line_contacts_account_line_user_id_key;
alter table public.line_contacts add constraint line_contacts_account_line_user_id_key unique (account_id, line_user_id);

-- 顧客: 0012の条件付きUNIQUE(customers_line_user_id_unique_idx)→アカウント内で1つ。
-- 0012と同じく、既存データに重複がある場合は追加せずにNOTICEを出して先へ進む(既存データは変更しない)
drop index if exists public.customers_line_user_id_unique_idx;
do $$
declare
  duplicate_count integer;
begin
  select count(*) into duplicate_count
  from (
    select account_id, line_user_id from public.customers
    where line_user_id <> ''
    group by account_id, line_user_id
    having count(*) > 1
  ) duplicates;

  if duplicate_count = 0 then
    create unique index if not exists customers_account_line_user_id_unique_idx
      on public.customers (account_id, line_user_id)
      where line_user_id <> '';
  else
    raise notice 'customers.line_user_id: アカウント内の重複が%件あるためUNIQUEインデックスの追加をスキップしました', duplicate_count;
  end if;
end;
$$;

-- ============================================================
-- 5. LINE紐づけチェック(0012)を同じアカウントの中だけで照合する
-- ============================================================
create or replace function public.check_line_contact_customer_match()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  customer_line_user_id text;
begin
  if new.customer_id is null then
    return new;
  end if;

  select btrim(line_user_id) into customer_line_user_id
  from public.customers
  where id = new.customer_id and account_id = new.account_id;

  if customer_line_user_id is not null
     and customer_line_user_id <> ''
     and customer_line_user_id <> new.line_user_id then
    raise exception
      'この顧客には別のLINEユーザーIDが登録されているため紐づけできません(customer_id=%)',
      new.customer_id;
  end if;

  if exists (
    select 1 from public.customers
    where id <> new.customer_id
      and account_id = new.account_id
      and btrim(line_user_id) = new.line_user_id
  ) then
    raise exception
      'このLINEユーザーIDは別の顧客に登録されているため紐づけできません(customer_id=%)',
      new.customer_id;
  end if;

  return new;
end;
$$;

create or replace function public.check_customer_line_user_id_match()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.line_user_id is not distinct from old.line_user_id then
    return new;
  end if;
  if btrim(new.line_user_id) = '' then
    return new;
  end if;

  if exists (
    select 1 from public.line_contacts
    where customer_id = new.id
      and account_id = new.account_id
      and line_user_id <> btrim(new.line_user_id)
  ) then
    raise exception
      'この顧客は別のLINEユーザーIDのLINE相手と紐づいているため変更できません(customer_id=%)',
      new.id;
  end if;

  if exists (
    select 1 from public.line_contacts
    where line_user_id = btrim(new.line_user_id)
      and account_id = new.account_id
      and customer_id is not null
      and customer_id <> new.id
  ) then
    raise exception
      'このLINEユーザーIDは別の顧客のLINE相手と紐づいているため登録できません(customer_id=%)',
      new.id;
  end if;

  return new;
end;
$$;

-- ============================================================
-- 6. 統合関数の置き換え(アカウントの確認・生年月日の確認・理由の記録)
-- ============================================================
alter table public.customer_merges add column if not exists reason text null;
comment on column public.customer_merges.reason is
  '生年月日が一致しない顧客を統合した場合に、スタッフが入力した理由';

drop function if exists public.merge_customers(uuid, uuid, uuid);

-- 生年月日の判定用: 顧客の birthday、無ければその顧客の最新の申込の birth_date
create or replace function public.customer_effective_birthday(p_customer_id uuid)
returns date
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (select birthday from public.customers where id = p_customer_id),
    (select birth_date from public.free_reading_requests
     where customer_id = p_customer_id and birth_date is not null
     order by application_date desc nulls last, created_at desc
     limit 1)
  );
$$;

revoke all on function public.customer_effective_birthday(uuid) from public, anon, authenticated;
grant execute on function public.customer_effective_birthday(uuid) to service_role;

create or replace function public.merge_customers(
  p_source_customer_id uuid,
  p_target_customer_id uuid,
  p_staff_id uuid,
  p_reason text default null
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
  v_source_birthday date;
  v_target_birthday date;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
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

  -- アカウントをまたぐ統合は禁止(鯛子と夜宵の顧客は同じ名前でも別人として扱う)
  if v_source.account_id <> v_target.account_id then
    raise exception 'MERGE_CROSS_ACCOUNT';
  end if;

  -- 非表示中(統合済みを含む)の顧客は統合しない
  if v_source.deleted_at is not null or v_target.deleted_at is not null
     or v_source.merged_into_customer_id is not null
     or v_target.merged_into_customer_id is not null then
    raise exception 'MERGE_CUSTOMER_HIDDEN';
  end if;

  -- 生年月日が両方わかっていて一致しない場合は、理由が入力されたときだけ統合する
  v_source_birthday := public.customer_effective_birthday(p_source_customer_id);
  v_target_birthday := public.customer_effective_birthday(p_target_customer_id);
  if v_source_birthday is not null and v_target_birthday is not null
     and v_source_birthday <> v_target_birthday and v_reason is null then
    raise exception 'MERGE_BIRTHDAY_MISMATCH';
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

  if v_source_contact.id is not null and v_target_contact.id is not null then
    raise exception 'MERGE_LINE_BOTH_LINKED';
  end if;

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
  if v_source_line_user_id <> '' then
    update public.customers set line_user_id = '' where id = p_source_customer_id;
  end if;

  if v_source_contact.id is not null then
    update public.line_contacts
    set customer_id = p_target_customer_id, linked_at = now(), linked_by = p_staff_id
    where id = v_source_contact.id;
  end if;

  if v_source_line_user_id <> '' and v_target_line_user_id = '' then
    update public.customers set line_user_id = v_source_line_user_id where id = p_target_customer_id;
    v_target_filled := true;
  end if;

  -- ---------- 関連データの付け替え(同じアカウント内のみ。複合外部キーでも保証される) ----------
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
    account_id, source_customer_id, target_customer_id, merged_by, moved_counts,
    moved_line_contact_id, source_line_user_id, target_line_user_id_filled, reason
  ) values (
    v_source.account_id, p_source_customer_id, p_target_customer_id, p_staff_id, v_counts,
    v_source_contact.id, nullif(v_source_line_user_id, ''), v_target_filled, v_reason
  );

  return v_counts;
end;
$$;

comment on function public.merge_customers(uuid, uuid, uuid, text) is
  '顧客統合(同じアカウント内のみ)。生年月日が一致しない場合は理由が必要。service_roleのみ実行可。1回の呼び出しが1トランザクション';

revoke all on function public.merge_customers(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.merge_customers(uuid, uuid, uuid, text) to service_role;

-- ============================================================
-- 7. アカウントでの絞り込み用の索引
-- ============================================================
create index if not exists customers_account_created_at_idx
  on public.customers (account_id, created_at desc);
create index if not exists free_reading_requests_account_application_idx
  on public.free_reading_requests (account_id, application_date desc, created_at desc);
create index if not exists line_contacts_account_last_message_idx
  on public.line_contacts (account_id, last_message_at desc);

commit;
