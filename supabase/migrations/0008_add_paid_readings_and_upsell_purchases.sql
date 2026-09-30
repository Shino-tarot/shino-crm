-- shino-crm: 有料鑑定購入履歴 / アップセル購入履歴テーブル新設
--
-- 背景:
--   顧客カルテ型CRMへの拡張に伴い、1人の顧客(customers)に対して
--   複数回の有料鑑定購入・複数回のアップセル購入を記録できるようにする。
--   paid_reading_1 / upsell_1 のように顧客側へカラムを増やす設計ではなく、
--   customer_id で紐づく独立テーブルへ「行を追加していく」設計にする。
--
--   customersテーブルは0001_init.sqlで作成済み(2026-09-30時点で0件・未使用)のため、
--   新しい顧客マスタは作らず、この既存customersを顧客の起点として再利用する。
--
-- 金額(amount)は日本円を前提とし、小数を扱わないためinteger(円単位の整数)で保存する。
-- 既存のcustomer_records.amountと同じ型に揃えている(例: 6980円 → 6980)。
--
-- 商品名(product_name)・商品種別(product_type)・購入経路(payment_method)は、
-- 将来の商品追加やLINE以外の決済手段追加を妨げないよう、DB側にCHECK制約や
-- enumを設けず自由文字列として保存する(許容値が必要ならアプリ側で管理する)。
--
-- 誤操作による削除事故を防ぐため、物理削除ではなくdeleted_atによる論理削除を
-- 前提としたカラムを用意する(アプリ側は「削除=deleted_atをセット」「一覧は
-- deleted_at is nullのみ表示・集計対象とする」という運用を想定。物理削除の
-- UIは今回は作らない)。

create table if not exists public.paid_readings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  purchase_date date not null default current_date,
  product_name text not null default '',
  amount integer not null default 0,
  payment_method text null,
  hearing_content text null,
  reading_content text null,
  sent_at timestamptz null,
  memo text not null default '',
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.paid_readings is
  '有料鑑定の購入履歴(1顧客につき複数件可)。ヒアリング内容・送付した鑑定文も同じレコードに保持する';
comment on column public.paid_readings.customer_id is '購入した顧客(customers.id)。顧客削除時は連動して削除する';
comment on column public.paid_readings.purchase_date is '購入日';
comment on column public.paid_readings.product_name is '商品名(自由記述。将来の商品追加のためCHECK制約・enum化はしない)';
comment on column public.paid_readings.amount is '購入金額(円。整数で保存し、小数・通貨記号は扱わない)';
comment on column public.paid_readings.payment_method is '購入経路・決済方法(任意入力の自由記述。例: LINE Pay/銀行振込/現金など)';
comment on column public.paid_readings.hearing_content is 'この鑑定を作成するために聞いたヒアリング内容(LINE文面の貼り付け等を想定した長文自由記述)';
comment on column public.paid_readings.reading_content is '実際にお客様へ送付した鑑定文(数千文字を想定した長文)';
comment on column public.paid_readings.sent_at is '鑑定文を送付した日時(purchase_date=購入日とは別役割。未送付はNULL)';
comment on column public.paid_readings.deleted_at is '論理削除日時。NULLの行のみ通常表示・集計対象とする(物理削除はしない運用を想定)';

create index if not exists paid_readings_customer_id_idx
  on public.paid_readings (customer_id);
create index if not exists paid_readings_customer_id_active_idx
  on public.paid_readings (customer_id) where deleted_at is null;

create table if not exists public.upsell_purchases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  purchase_date date not null default current_date,
  product_name text not null default '',
  product_type text null,
  amount integer not null default 0,
  memo text not null default '',
  deleted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.upsell_purchases is
  'アップセル商品(ヒーリング・継続鑑定・パワーストーン等)の購入履歴(1顧客につき複数件可)';
comment on column public.upsell_purchases.customer_id is '購入した顧客(customers.id)。顧客削除時は連動して削除する';
comment on column public.upsell_purchases.product_name is '商品名(自由記述。将来の商品追加のためCHECK制約・enum化はしない)';
comment on column public.upsell_purchases.product_type is '商品種別(任意の自由記述。例: healing/continuation/stone等。enum化しない)';
comment on column public.upsell_purchases.amount is '購入金額(円。整数で保存)';
comment on column public.upsell_purchases.deleted_at is '論理削除日時。NULLの行のみ通常表示・集計対象とする';

create index if not exists upsell_purchases_customer_id_idx
  on public.upsell_purchases (customer_id);
create index if not exists upsell_purchases_customer_id_active_idx
  on public.upsell_purchases (customer_id) where deleted_at is null;

-- updated_at自動更新トリガー(0001_init.sqlで定義済みのset_updated_at()を再利用)
create trigger paid_readings_set_updated_at
  before update on public.paid_readings
  for each row execute function set_updated_at();

create trigger upsell_purchases_set_updated_at
  before update on public.upsell_purchases
  for each row execute function set_updated_at();

-- ============================================================
-- RLS: customers / customer_records と同じ方針に揃える
-- 管理画面はservice_role経由(サーバーアクション)からのみアクセスし、
-- anon(公開フォーム等)からの直接アクセスは一切許可しない。
-- ============================================================
alter table public.paid_readings enable row level security;
alter table public.upsell_purchases enable row level security;

grant select, insert, update, delete
on table public.paid_readings
to service_role;

grant select, insert, update, delete
on table public.upsell_purchases
to service_role;

-- anonロールへのポリシーは意図的に作成しない
-- (公開フォームはfree_reading_requestsへのINSERTのみを許可する設計のため、
--  本テーブルが匿名から書き込み・閲覧できる状態にはしない)
