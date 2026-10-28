-- ステータス自動更新・無料鑑定送信24時間後フォロー通知のためのDB変更
--
-- 【未実行】このファイルはまだ検証用DB・本番DBのどちらでも実行していません。
-- 実行はオーナーが明示的に指示したタイミングで行うこと(まず検証用DBのみ)。
--
-- 背景:
--   無料鑑定・有料鑑定の送信日時を過ぎたら申込ステータスを自動で進め、
--   無料鑑定送信から24時間経過しても「詳細希望」の返答がないお客様を
--   CRM内でフォロー通知できるようにする。
--   「送信予約中」は送信日時が未来かどうかで画面側が補助バッジを出すだけなので、
--   ステータスとしては追加しない。
--
-- 変更内容:
--   1. statusに 'paid_reading_sent'(有料鑑定送信済み)を追加
--   2. free_reading_requestsに詳細希望(detail_request)・フォロー済み日時(followed_up_at)を追加
--   3. 自動更新の実行履歴テーブル(status_auto_updates)を新設
--      → 送信イベント1件につき自動更新は1回だけ。送信日時の修正や手動変更後に再実行されない
--   4. 機能の導入日時テーブル(crm_feature_launches)を新設
--      → 導入前から対象だったフォロー対象・送信済みデータを、導入後のものと区別する
--
-- 既存データへの影響:
--   既存の行・既存ステータスの値は一切変更・削除しない(UPDATE/DELETEを含まない)。
--   追加カラムはすべてNULL許容でデフォルト値なし(既存行はNULL=未回答・未フォローのまま)。
--
-- 再実行について:
--   すべて「if not exists」「drop ... if exists → add」「on conflict do nothing」で書いており、
--   2回実行しても結果は変わらない。導入日時も初回実行時の値が保持される。
--   途中で失敗した場合はトランザクションにより全体が取り消される。

begin;

-- ============================================================
-- 1. statusのCHECK制約に 'paid_reading_sent' を追加
--    (0010_remove_diagnosis_web_app_fields.sql の許可リスト + 1件)
-- ============================================================
alter table public.free_reading_requests
  drop constraint if exists free_reading_requests_status_check;
alter table public.free_reading_requests
  add constraint free_reading_requests_status_check
    check (status in (
      'new',
      'contacted',
      'converted',
      'archived',
      'awaiting_free_reading',
      'in_reading',
      'free_reading_sent',
      'paid_reading_proposed',
      'completed',
      -- 有料鑑定送信済み(紐づく顧客の有料鑑定を送信したら進める)
      'paid_reading_sent'
    ));

-- ============================================================
-- 2. 詳細希望・フォロー済み日時
-- ============================================================
-- 詳細希望: NULL=未回答 / 'yes'=あり / 'no'=なし
alter table public.free_reading_requests
  add column if not exists detail_request text null;

alter table public.free_reading_requests
  drop constraint if exists free_reading_requests_detail_request_check;
alter table public.free_reading_requests
  add constraint free_reading_requests_detail_request_check
    check (detail_request is null or detail_request in ('yes', 'no'));

alter table public.free_reading_requests
  add column if not exists followed_up_at timestamptz null;

comment on column public.free_reading_requests.detail_request is
  '無料鑑定後の詳細希望(NULL=未回答 / yes=あり / no=なし)。未回答のみフォロー通知の対象';
comment on column public.free_reading_requests.followed_up_at is
  'フォローを実施した日時(未フォローはNULL)。値があるお客様はフォロー通知の対象外';

-- フォロー通知の対象(詳細希望が未回答かつ未フォロー)を送信日時で絞り込むための部分インデックス
create index if not exists free_reading_requests_followup_target_idx
  on public.free_reading_requests (sent_at)
  where detail_request is null and followed_up_at is null;

-- ============================================================
-- 3. 自動更新の実行履歴
-- ============================================================
-- 送信イベント(無料鑑定の送信 / 有料鑑定1件ごとの送信)1件につき1行だけ記録する。
-- (event_type, source_id) のUNIQUE制約により、同じイベントで自動更新が2回走ることはない。
-- ステータスを進めなかった場合(対応不要・完了・すでに先の段階など)も 'skipped' として記録し、
-- 後から手動でステータスを戻しても、同じイベントで再び自動更新されないようにする。
create table if not exists public.status_auto_updates (
  id uuid primary key default gen_random_uuid(),
  free_reading_request_id uuid not null
    references public.free_reading_requests(id) on delete cascade,
  event_type text not null check (
    event_type in ('free_reading_sent', 'paid_reading_sent')
  ),
  -- free_reading_sent: free_reading_requests.id / paid_reading_sent: paid_readings.id
  source_id uuid not null,
  from_status text not null,
  to_status text not null,
  result text not null check (result in ('applied', 'skipped')),
  created_at timestamptz not null default now(),
  constraint status_auto_updates_event_unique unique (event_type, source_id)
);

comment on table public.status_auto_updates is
  'ステータス自動更新の実行履歴(送信イベント1件につき1行。再実行・意図しない上書きの防止用)';
comment on column public.status_auto_updates.source_id is
  '送信イベントの元レコードID(free_reading_sent=無料鑑定申込ID / paid_reading_sent=有料鑑定ID)';
comment on column public.status_auto_updates.result is
  'applied=ステータスを進めた / skipped=対象外のため進めなかった(どちらも再実行はしない)';

create index if not exists status_auto_updates_request_id_idx
  on public.status_auto_updates (free_reading_request_id);

-- ============================================================
-- 4. 機能の導入日時
-- ============================================================
-- このファイルを実行した日時を導入日時として記録する。
--   followup_notice   : 24時間経過がこれ以降なら「新規フォロー通知」、より前なら「過去分の確認」
--   status_auto_update: 送信日時がこれ以降の送信イベントのみ自動更新の対象にする
--                       (導入前の送信済みデータの初回一括更新は、別途オーナー承認のうえで行う)
create table if not exists public.crm_feature_launches (
  feature text primary key,
  launched_at timestamptz not null default now()
);

comment on table public.crm_feature_launches is
  'CRM機能の導入日時(導入前から存在するデータと導入後に発生したデータを区別するために使う)';

-- 再実行しても初回の導入日時を上書きしない
insert into public.crm_feature_launches (feature)
values ('followup_notice'), ('status_auto_update')
on conflict (feature) do nothing;

-- ============================================================
-- RLS: 既存テーブルと同じ方針(管理画面はservice_role経由のみ、anonからは一切アクセス不可)
-- ============================================================
alter table public.status_auto_updates enable row level security;
alter table public.crm_feature_launches enable row level security;

grant select, insert, update, delete
on table public.status_auto_updates
to service_role;

grant select, insert, update, delete
on table public.crm_feature_launches
to service_role;

-- anonロールへのポリシーは意図的に作成しない

commit;
