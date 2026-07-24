-- shino-crm: 初期テーブル作成
-- customers / customer_records / free_reading_requests

-- 拡張機能（gen_random_uuid()を使うため）
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. customers（顧客マスタ）
-- ============================================================
create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  customer_no bigint generated always as identity,
  line_name text not null default '',
  reading_name text not null default '',
  real_name text not null default '',
  line_user_id text not null default '',
  age smallint,
  gender text not null default '',
  birthday date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table customers is '顧客マスタ';
comment on column customers.customer_no is '顧客番号（自動採番）';
comment on column customers.reading_name is '鑑定名（ニックネーム）';

-- ============================================================
-- 2. customer_records（顧客ごとの相談・鑑定・購入・メモ記録）
-- ============================================================
create table if not exists customer_records (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  category text not null check (
    category in ('consultation', 'freeReading', 'formalReading', 'purchase', 'memo')
  ),
  record_date date,
  title text not null default '',
  content text not null default '',
  amount integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table customer_records is '顧客ごとの相談内容・鑑定・購入履歴・メモ';

create index if not exists customer_records_customer_id_idx
  on customer_records (customer_id);

-- ============================================================
-- 3. free_reading_requests（無料鑑定フォームの申込受付）
-- ============================================================
create table if not exists free_reading_requests (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'new' check (
    status in ('new', 'contacted', 'converted', 'archived')
  ),
  reading_name text not null default '',
  line_name text not null default '',
  real_name text not null default '',
  age smallint,
  gender text not null default '',
  birthday date,
  contact text not null default '',
  content text not null default '',
  customer_id uuid references customers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table free_reading_requests is '無料鑑定フォームからの申込受付（未対応→顧客登録への変換フロー）';

create index if not exists free_reading_requests_status_idx
  on free_reading_requests (status);

-- ============================================================
-- updated_at 自動更新トリガー
-- ============================================================
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger customers_set_updated_at
  before update on customers
  for each row execute function set_updated_at();

create trigger customer_records_set_updated_at
  before update on customer_records
  for each row execute function set_updated_at();

create trigger free_reading_requests_set_updated_at
  before update on free_reading_requests
  for each row execute function set_updated_at();

-- ============================================================
-- RLS（Row Level Security）
-- ============================================================
alter table customers enable row level security;
alter table customer_records enable row level security;
alter table free_reading_requests enable row level security;

-- customers / customer_records は現時点では管理画面（認証未実装）専用のため
-- service_role（サーバー側）からのみアクセス許可。anonからのアクセスは不可。
-- ログイン機能実装後、authenticatedユーザー向けポリシーに置き換える想定。

-- free_reading_requests は公開フォームからの新規申込（INSERT）のみ許可。
-- 参照・更新・削除は許可しない（管理画面はservice_role経由で行う）。
create policy "anon can insert free reading requests"
  on free_reading_requests
  for insert
  to anon
  with check (true);
