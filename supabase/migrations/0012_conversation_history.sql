-- お客様との会話履歴(LINE自動保存 + 手動登録)のためのDB変更
--
-- 【実行状況】検証用DB(shino-crm-test): 実行済み / 本番DB: 未実行
-- 実行はオーナーが明示的に指示したタイミングで行うこと(まず検証用DBのみ)。
--
-- 背景:
--   LINE公式アカウントのWebhookで受信したお客様からのメッセージを自動保存し、
--   鯛子がLINE公式アプリから送ったメッセージ(Webhookでは届かない)は手動で登録する。
--   無料鑑定〜本鑑定〜購入後フォローまでを、顧客ごとに時系列で表示できるようにする。
--
-- 変更内容:
--   1. line_contacts(LINEの相手)を新設
--      → LINEユーザーIDごとに1行。customer_idがNULLの行=「未紐づけ」
--   2. conversation_messages(会話履歴)を新設
--   3. 誤紐づけ・自動保存分の改ざん/削除を防ぐトリガー
--   4. customers.line_user_id の重複禁止(既存データに重複が無い場合のみ追加)
--
-- 紐づけの考え方(LINEのIDが異なる顧客へ誤って紐づかないための設計):
--   - LINEから自動保存した履歴は customer_id を持たず、line_contact_id だけを持つ。
--     どの顧客の履歴かは常に line_contacts.customer_id から決まる。
--     → 紐づけ・紐づけ解除は line_contacts の1行を更新するだけで、履歴側の書き換えは不要。
--       「LINE相手はAさんに紐づいているのに、履歴の一部だけBさんに付いている」状態が構造上起きない。
--   - 手動登録した履歴は customer_id を直接持ち、line_contact_id は持たない。
--   - 顧客(customers.line_user_id)に既にLINEユーザーIDが入力されている場合、
--     それと異なるLINEユーザーIDの相手はその顧客へ紐づけられない(トリガーで拒否)。
--   - 1人の顧客に紐づけられるLINEの相手は1件まで。
--
-- 既存データへの影響:
--   既存テーブルの行は一切変更・削除しない(UPDATE/DELETEを含まない)。
--   customersに対しては、トリガー(今後の矛盾した更新を拒否するだけ)と
--   条件付きのUNIQUEインデックスを追加するのみ。
--
-- 再実行について:
--   「if not exists」「create or replace」「drop ... if exists → create」で書いており、
--   2回実行しても結果は変わらない。途中で失敗した場合はトランザクションにより全体が取り消される。
--
-- ============================================================
-- 【実行前の確認】customers.line_user_id の既存データ(読み取りのみのSQL)
-- ============================================================
-- 4.のUNIQUEインデックスは、既存データに重複がある場合は追加せずにスキップする
-- (マイグレーション全体は失敗させず、NOTICEを出すだけ)。実行前に以下で状況を確認しておくこと。
--
--   -- (a) 完全一致の重複(1件でもあればUNIQUEインデックスは追加されない)
--   select line_user_id, count(*), array_agg(id) as customer_ids
--   from public.customers
--   where line_user_id <> ''
--   group by line_user_id
--   having count(*) > 1;
--
--   -- (b) 前後の空白を除くと重複になるもの(インデックスは追加されるが、実質的な重複の疑い)
--   select btrim(line_user_id) as normalized, count(*), array_agg(id) as customer_ids
--   from public.customers
--   where btrim(line_user_id) <> ''
--   group by btrim(line_user_id)
--   having count(*) > 1;
--
--   -- (c) LINEユーザーIDの形式(U + 英数字32桁)ではない値(表示名などの誤入力の疑い)
--   select id, line_user_id
--   from public.customers
--   where line_user_id <> ''
--     and line_user_id !~ '^U[0-9a-f]{32}$';
--
-- (a)〜(c)がすべて0件なら、そのまま実行してよい。
-- 1件以上ある場合は、どの顧客の値を正とするかをオーナーが判断し、画面から修正してから実行する
-- (このマイグレーションでは既存の値を自動修正しない)。
-- 実行後は、NOTICEの内容 または 以下で、インデックスが追加されたかを確認できる。
--   select indexname from pg_indexes where indexname = 'customers_line_user_id_unique_idx';

begin;

-- ============================================================
-- 1. line_contacts(LINEの相手)
-- ============================================================
create table if not exists public.line_contacts (
  id uuid primary key default gen_random_uuid(),
  -- LINEのユーザーID(U + 英数字32桁)。同じ相手は1行だけ
  line_user_id text not null unique
    check (line_user_id ~ '^U[0-9a-f]{32}$'),
  -- 紐づく顧客。NULL=未紐づけ。顧客が削除された場合は未紐づけに戻す(履歴は残す)
  customer_id uuid null references public.customers(id) on delete set null,
  display_name text not null default '',
  picture_url text null,
  -- friend=友だち / blocked=ブロックされた / unknown=不明(友だち追加イベントを受け取る前など)
  friend_status text not null default 'unknown'
    check (friend_status in ('friend', 'blocked', 'unknown')),
  -- 紐づけ操作をした日時・スタッフ(auth.users.id)。紐づけ解除時はNULLに戻す
  linked_at timestamptz null,
  linked_by uuid null,
  last_message_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.line_contacts is
  'LINE公式アカウントのやり取り相手(LINEユーザーIDごとに1行)。customer_idがNULLの行は未紐づけ';
comment on column public.line_contacts.line_user_id is 'LINEユーザーID(Webhookのsource.userId)。形式: U + 英数字32桁';
comment on column public.line_contacts.customer_id is
  '紐づく顧客(customers.id)。NULL=未紐づけ。紐づけ・解除はスタッフの明示操作のみで行う(表示名等による自動判定はしない)';
comment on column public.line_contacts.display_name is 'LINE表示名(プロフィール取得時点の値。お客様側で変更されうる)';
comment on column public.line_contacts.friend_status is 'friend=友だち / blocked=ブロック中 / unknown=不明';
comment on column public.line_contacts.linked_by is '紐づけ操作をしたスタッフ(auth.users.id)';
comment on column public.line_contacts.last_message_at is '最後にメッセージを受信した日時(未紐づけ一覧の並び替え用)';

-- 1人の顧客に紐づけられるLINEの相手は1件まで
create unique index if not exists line_contacts_customer_id_unique_idx
  on public.line_contacts (customer_id)
  where customer_id is not null;

-- 「未紐づけのLINEメッセージ」一覧用
create index if not exists line_contacts_unlinked_idx
  on public.line_contacts (last_message_at desc)
  where customer_id is null;

-- ============================================================
-- 2. conversation_messages(会話履歴)
-- ============================================================
create table if not exists public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  -- 手動登録の履歴のみ値を持つ。顧客削除時は連動して削除する(paid_readings等と同じ)
  customer_id uuid null references public.customers(id) on delete cascade,
  -- LINE自動保存の履歴のみ値を持つ。LINEの相手が残っている限り履歴も消えないよう削除を制限する
  line_contact_id uuid null references public.line_contacts(id) on delete restrict,
  -- incoming=受信(お客様→鯛子) / outgoing=送信(鯛子→お客様)
  direction text not null check (direction in ('incoming', 'outgoing')),
  -- line_webhook=LINEから自動保存 / manual=スタッフが手動登録
  source text not null check (source in ('line_webhook', 'manual')),
  message_type text not null default 'text' check (
    message_type in ('text', 'image', 'video', 'audio', 'file', 'location', 'sticker', 'other')
  ),
  -- 本文。テキスト以外(画像・スタンプ等)は「画像が届きました」等の説明文を入れる想定
  body text not null default '',
  -- 実際に送受信した日時(LINE自動保存はWebhookのtimestamp、手動登録はスタッフが入力した日時)
  sent_at timestamptz not null,
  -- LINEのWebhookイベントID。同じ通知の再送を二重保存しないためにUNIQUE
  line_webhook_event_id text null unique,
  -- LINEのメッセージID(テキスト以外の内容を後から取得する場合に使う)
  line_message_id text null,
  -- 手動登録・編集したスタッフ(auth.users.id)
  created_by uuid null,
  updated_by uuid null,
  -- 論理削除日時(手動登録の履歴のみ)。NULLの行のみ通常表示する
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- LINE自動保存: 受信のみ・LINEの相手とイベントIDが必須・customer_idは持たない・論理削除しない
  constraint conversation_messages_webhook_shape_check check (
    source <> 'line_webhook' or (
      direction = 'incoming'
      and line_contact_id is not null
      and customer_id is null
      and line_webhook_event_id is not null
      and deleted_at is null
    )
  ),
  -- 手動登録: 顧客が必須・LINEの相手やLINEのIDは持たない
  constraint conversation_messages_manual_shape_check check (
    source <> 'manual' or (
      customer_id is not null
      and line_contact_id is null
      and line_webhook_event_id is null
      and line_message_id is null
    )
  )
);

comment on table public.conversation_messages is
  'お客様との会話履歴。LINE自動保存(受信)はline_contact_id経由で、手動登録はcustomer_idで顧客に紐づく';
comment on column public.conversation_messages.customer_id is
  '手動登録の履歴のみ。LINE自動保存の履歴はNULL(顧客はline_contacts.customer_idから決まる)';
comment on column public.conversation_messages.line_contact_id is
  'LINE自動保存の履歴のみ。手動登録の履歴はNULL';
comment on column public.conversation_messages.direction is 'incoming=受信(お客様→鯛子) / outgoing=送信(鯛子→お客様)';
comment on column public.conversation_messages.source is 'line_webhook=LINEから自動保存(編集・削除不可) / manual=手動登録(編集・論理削除可)';
comment on column public.conversation_messages.sent_at is '実際に送受信した日時';
comment on column public.conversation_messages.line_webhook_event_id is 'LINEのwebhookEventId。再送による二重保存を防ぐためUNIQUE';
comment on column public.conversation_messages.deleted_at is '論理削除日時(手動登録のみ)。NULLの行のみ通常表示する';

-- 顧客ごとの時系列表示用(手動登録分)
create index if not exists conversation_messages_customer_sent_at_idx
  on public.conversation_messages (customer_id, sent_at)
  where customer_id is not null and deleted_at is null;

-- 顧客ごとの時系列表示・未紐づけ一覧用(LINE自動保存分)
create index if not exists conversation_messages_line_contact_sent_at_idx
  on public.conversation_messages (line_contact_id, sent_at)
  where line_contact_id is not null;

-- ============================================================
-- 3. トリガー
-- ============================================================
-- updated_at自動更新(0001_init.sqlで定義済みのset_updated_at()を再利用)
drop trigger if exists line_contacts_set_updated_at on public.line_contacts;
create trigger line_contacts_set_updated_at
  before update on public.line_contacts
  for each row execute function set_updated_at();

drop trigger if exists conversation_messages_set_updated_at on public.conversation_messages;
create trigger conversation_messages_set_updated_at
  before update on public.conversation_messages
  for each row execute function set_updated_at();

-- 3-1. LINEの相手を顧客へ紐づけるとき、次の場合は拒否する
--      (a) 紐づけ先の顧客に、別のLINEユーザーIDが入力済み
--      (b) このLINEユーザーIDが、別の顧客のLINEユーザーIDとして入力済み
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
  where id = new.customer_id;

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
      and btrim(line_user_id) = new.line_user_id
  ) then
    raise exception
      'このLINEユーザーIDは別の顧客に登録されているため紐づけできません(customer_id=%)',
      new.customer_id;
  end if;

  return new;
end;
$$;

drop trigger if exists line_contacts_check_customer_match on public.line_contacts;
create trigger line_contacts_check_customer_match
  before insert or update of customer_id, line_user_id on public.line_contacts
  for each row execute function public.check_line_contact_customer_match();

-- 3-2. 顧客のLINEユーザーIDを入力・変更するとき、次の場合は拒否する
--      (a) この顧客が、別のLINEユーザーIDのLINEの相手と紐づいている
--      (b) 入力したLINEユーザーIDのLINEの相手が、別の顧客に紐づいている
--      (顧客編集画面は保存のたびにline_user_idを送るため、更新時は値が変わったときだけ判定する。
--       既存の行・値は判定しないので、このトリガー追加で既存データが拒否されることはない)
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
      and line_user_id <> btrim(new.line_user_id)
  ) then
    raise exception
      'この顧客は別のLINEユーザーIDのLINE相手と紐づいているため変更できません(customer_id=%)',
      new.id;
  end if;

  if exists (
    select 1 from public.line_contacts
    where line_user_id = btrim(new.line_user_id)
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

drop trigger if exists customers_check_line_user_id_match on public.customers;
create trigger customers_check_line_user_id_match
  before insert or update of line_user_id on public.customers
  for each row execute function public.check_customer_line_user_id_match();

-- 3-3. LINE自動保存の履歴は変更・削除(物理削除)とも不可。
--      手動登録の履歴は編集・論理削除(deleted_atのセット)が可能で、「手動→自動」等の種別変更は不可。
--      手動登録の履歴の物理削除は、顧客削除時の連動削除(on delete cascade)のために許可したままにする。
--      ※行単位のトリガーのため、TRUNCATEはこの保護の対象外(アプリからは使わない)。
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
    raise exception 'LINEから自動保存した会話履歴は変更できません(id=%)', old.id;
  end if;
  if new.source is distinct from old.source then
    raise exception '会話履歴の登録種別は変更できません(id=%)', old.id;
  end if;
  return new;
end;
$$;

drop trigger if exists conversation_messages_protect on public.conversation_messages;
create trigger conversation_messages_protect
  before update or delete on public.conversation_messages
  for each row execute function public.protect_conversation_message();

-- ============================================================
-- 4. customers.line_user_id の重複禁止(条件付き)
-- ============================================================
-- 空欄('')は複数あってよいので、空欄以外だけを対象にする。
-- 既存データに重複がある場合はインデックスを追加せず、NOTICEを出して先へ進む
-- (既存の顧客データは変更しない。重複を解消してからこのファイルを再実行すれば追加される)。
do $$
declare
  duplicate_count integer;
begin
  select count(*) into duplicate_count
  from (
    select line_user_id
    from public.customers
    where line_user_id <> ''
    group by line_user_id
    having count(*) > 1
  ) duplicates;

  if duplicate_count = 0 then
    create unique index if not exists customers_line_user_id_unique_idx
      on public.customers (line_user_id)
      where line_user_id <> '';
    raise notice 'customers.line_user_id: 重複なし。UNIQUEインデックスを追加しました(既に存在する場合は変更なし)';
  else
    raise notice 'customers.line_user_id: 重複が%件あるためUNIQUEインデックスの追加をスキップしました。ファイル冒頭の確認SQL(a)で対象を確認してください', duplicate_count;
  end if;
end;
$$;

-- ============================================================
-- RLS: 既存テーブルと同じ方針(管理画面・Webhookはservice_role経由のみ、anonからは一切アクセス不可)
-- ============================================================
alter table public.line_contacts enable row level security;
alter table public.conversation_messages enable row level security;

grant select, insert, update, delete
on table public.line_contacts
to service_role;

grant select, insert, update, delete
on table public.conversation_messages
to service_role;

-- anonロールへのポリシーは意図的に作成しない

commit;
