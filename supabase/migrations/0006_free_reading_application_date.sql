-- free_reading_requests: 申込日(application_date)カラム追加
--
-- 背景:
--   created_at は「CRMへ登録した日時」を表すタイムスタンプであり、
--   お客様が実際に無料鑑定へ申し込んだ日(LINE等で問い合わせがあった日)とは
--   一致しないケースがある(スタッフが後日まとめて登録する場合など)。
--   両者の役割を分離するため、実際の申込日を保持する application_date を追加する。
--
-- 型: date / NULL許可(過去データや未入力を許容するため)

alter table public.free_reading_requests
  add column if not exists application_date date null;

comment on column public.free_reading_requests.application_date is
  'お客様が実際に無料鑑定へ申し込んだ日(created_atはCRMへの登録日時であり別役割)';
