-- free_reading_requests: anonロールにINSERT権限を付与
-- (RLSポリシーでinsertを許可していても、テーブル自体へのGRANTがないと
--  "permission denied for table free_reading_requests" になるため)
--
-- SELECT/UPDATE/DELETEは付与しない（公開フォームからは新規投稿のみ許可する設計のため）

grant insert on table public.free_reading_requests to anon;
