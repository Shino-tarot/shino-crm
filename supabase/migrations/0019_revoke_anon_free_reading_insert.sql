-- 公開用キー(anon)による無料鑑定申込の直接INSERTを止める
--
-- 【実行状況】検証用DB(shino-crm-test): 未実行 / 本番DB: 未実行
-- 実行はオーナーが明示的に指示したタイミングで行うこと(まず検証用DBのみ)。
--
-- 背景:
--   0001/0002で、公開フォームがブラウザから直接保存する想定で anon に free_reading_requests への
--   INSERT 権限と「無条件で許可(with check (true))」のRLSポリシーを付けていた。
--   現在の公開フォームはサーバー側(publicActions.ts、service_role)で保存しており、anon からの直接保存は使っていない
--   (ブラウザ用クライアント src/lib/supabase/client.ts はどこからも使われていない)。
--   このままだと、公開用キーを持つ人なら誰でも、任意の内容・任意のアカウント(夜宵を含む)の申込を
--   APIへ直接書き込めるため、アカウント分離(0016〜0018)とスパム対策(honeypot等)をすり抜けられる。
--
-- 変更内容:
--   1. anon の free_reading_requests への INSERT 権限を取り消す
--   2. RLSポリシー「anon can insert free reading requests」を削除する
--
-- このファイルで「しないこと」:
--   - 既存の行・値は一切変更・削除しない
--   - service_role(アプリのサーバー側)の権限は変更しない(公開フォーム・管理画面は従来どおり保存できる)
--
-- 再実行について: 「revoke」「drop policy if exists」のため、2回実行しても結果は変わらない。
--
-- 【実行前の確認】(読み取りのみ。想定と違う場合は実行せずに相談すること)
--   select
--     has_table_privilege('anon', 'public.free_reading_requests', 'INSERT') as anon_can_insert,          -- true(今は書き込める状態)
--     has_table_privilege('service_role', 'public.free_reading_requests', 'INSERT') as service_can_insert, -- true
--     (select count(*) from pg_policies
--      where tablename = 'free_reading_requests' and policyname = 'anon can insert free reading requests') as anon_policy, -- 1
--     (select count(*) from public.free_reading_requests) as requests_total;                            -- 値を控える
--
-- 実行後の確認(読み取りのみ):
--   select
--     has_table_privilege('anon', 'public.free_reading_requests', 'INSERT') as anon_can_insert,          -- false
--     has_table_privilege('service_role', 'public.free_reading_requests', 'INSERT') as service_can_insert, -- true
--     (select count(*) from pg_policies
--      where tablename = 'free_reading_requests' and policyname = 'anon can insert free reading requests') as anon_policy, -- 0
--     (select count(*) from public.free_reading_requests) as requests_total;                            -- 実行前と同じ
--
-- 元に戻す場合:
--   grant insert on table public.free_reading_requests to anon;
--   create policy "anon can insert free reading requests" on public.free_reading_requests
--     for insert to anon with check (true);

begin;

revoke insert on table public.free_reading_requests from anon;
drop policy if exists "anon can insert free reading requests" on public.free_reading_requests;

commit;
