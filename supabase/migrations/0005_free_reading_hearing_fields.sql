-- free_reading_requests: LINEヒアリング管理CRM対応
--
-- 背景:
--   src/lib/freeReadingRequests/mapper.ts は birth_date / partner_name /
--   partner_birth_date / partner_gender / ideal_future 列を前提に実装されているが、
--   これらの列は 0001〜0004 のマイグレーションには存在しない
--  （本番DBに直接追加された形跡があり、リポジトリのマイグレーションが
--    追いついていなかったと推測される）。
--   add column if not existsで、現状のDBがどちらの状態でも安全に整合させる。
--
-- 今回新たに追加するもの:
--   - memo: 管理者用の自由記述メモ（申込内容とは別に、対応状況や鑑定メモを記録する）

alter table public.free_reading_requests
  add column if not exists birth_date date null;

alter table public.free_reading_requests
  add column if not exists partner_name text null;

alter table public.free_reading_requests
  add column if not exists partner_birth_date date null;

alter table public.free_reading_requests
  add column if not exists partner_gender text null;

alter table public.free_reading_requests
  add column if not exists ideal_future text null;

alter table public.free_reading_requests
  add column if not exists memo text not null default '';

comment on column public.free_reading_requests.birth_date is '相談者の生年月日';
comment on column public.free_reading_requests.partner_name is '相手の名前';
comment on column public.free_reading_requests.partner_birth_date is '相手の生年月日';
comment on column public.free_reading_requests.partner_gender is '相手の性別（わかる場合のみ）';
comment on column public.free_reading_requests.ideal_future is '理想の未来';
comment on column public.free_reading_requests.memo is '管理者用メモ（対応状況・鑑定メモなど。申込者には見せない）';
