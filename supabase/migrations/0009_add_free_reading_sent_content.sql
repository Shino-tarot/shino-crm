-- free_reading_requests: 送付した無料鑑定文の保存
--
-- 背景:
--   診断Webアプリ連携を前提にせず、「実際にお客様へ送った無料鑑定文」を
--   CRM側の履歴として残せるようにする。
--   1件のfree_reading_requestsレコード = 1回の無料鑑定申込であり、
--   それに対して送付する鑑定文は1つなので、新しいテーブルを作って
--   同じ情報を二重保存するのではなく、既存レコードへのカラム追加で対応する。
--
-- 追加するもの:
--   - sent_reading_content: 実際に送付した無料鑑定文(長文を想定しtext型)
--   - sent_at             : 無料鑑定文を送付した日時
--
-- 既存カラム(content/ideal_future等)・既存制約・既存データには一切影響しない。

alter table public.free_reading_requests
  add column if not exists sent_reading_content text null;

alter table public.free_reading_requests
  add column if not exists sent_at timestamptz null;

comment on column public.free_reading_requests.sent_reading_content is
  '実際にお客様へ送付した無料鑑定文(長文自由記述)';
comment on column public.free_reading_requests.sent_at is
  '無料鑑定文を送付した日時(application_date=申込日、created_at=CRM登録日時とは別役割。未送付はNULL)';
