-- free_reading_requests: 無料鑑定フォーム対応のカラム追加
--
-- 追加するもの:
--   - instagram_username : Instagramのユーザー名(@は含めない)。鑑定方法がinstagramの場合に入力
--                           LINE利用者はそもそも値を持たないため、空文字ではなくNULLを許可する
--                           プロフィールURL(https://instagram.com/{username})はCRM表示側で組み立てる
--   - contact_method      : 鑑定方法(line / instagram)。categoryカラムと同様にNOT NULL + CHECKで表現
--
-- 追加しないもの:
--   - status は 0001_init.sql で追加済み(初期値 'new')のため対象外
--
-- 実行前提: 2026年時点でfree_reading_requestsは0件のため、
--           contact_methodをNOT NULLとして追加してもデータ不整合は発生しない。

alter table public.free_reading_requests
  add column if not exists instagram_username text null;

alter table public.free_reading_requests
  add column if not exists contact_method text not null
    check (contact_method in ('line', 'instagram'));

comment on column public.free_reading_requests.instagram_username is
  'Instagramのユーザー名(@なし、contact_methodがinstagramの場合のみ値を持つ。LINE利用者はNULL)';
comment on column public.free_reading_requests.contact_method is
  '鑑定方法: line または instagram(フォームで必須選択)';
