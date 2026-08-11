-- free_reading_requests: 診断Webアプリ連携用フィールド追加
--
-- 背景:
--   Threads → 診断Webアプリ → 診断結果表示 → 鑑定コード発行 → LINE登録
--   → 鑑定コードをLINEで送信 → CRMで鑑定コード検索 という導線に対応するため、
--   診断Webアプリ側で発行・入力される情報をfree_reading_requestsへ保存できるようにする。
--   診断Webアプリ本体は今回実装しないが、将来同じテーブルへINSERTされる前提で設計する。
--
-- 追加するもの:
--   - diagnosis_code        : 診断Webアプリが発行する鑑定コード。
--                              LINEで届いたコードをCRMで検索する用途。手動登録では
--                              空欄(NULL)のままでよい。UNIQUE制約で重複を防ぐ。
--                              先頭0を保持する必要があるためtext型で保持する
--                              (numeric/integer型だと先頭0が失われるため)。
--                              現時点の運用ルールは「4〜6桁の数字」だが、将来
--                              英数字混在等へ変更される可能性を考慮し、DB側に
--                              フォーマットのCHECK制約は設けない(アプリ層で検証する)。
--   - diagnosis_theme       : 診断テーマの内部値(money/love/work/relationships/other)。
--                              将来テーマが増えてもDB変更が不要なようCHECK制約は設けず、
--                              許容値はアプリ側(TypeScript union + validation)で管理する。
--   - diagnosis_result_type : 診断Webアプリが表示した診断結果タイプの名称。
--                              名称は未確定のため、enum化・CHECK制約はせず自由な文字列として保存する。
--   - diagnosed_at          : Web診断を完了した日時。
--                              application_date(無料鑑定の申込日)・created_at(CRM登録日時)とは
--                              役割が異なる別カラムとして追加する。NULL許可。
--
-- status列のCHECK制約拡張:
--   既存ステータス(new/contacted/converted/archived)は変更・削除しない
--   (既存の公開フォーム(/free-reading)がstatus未指定でinsertしており、
--    DB defaultの'new'に依存しているため)。
--   診断Webアプリ連携後の進行管理用ステータスを追加で許可する。

alter table public.free_reading_requests
  add column if not exists diagnosis_code text null;

alter table public.free_reading_requests
  add column if not exists diagnosis_theme text null;

alter table public.free_reading_requests
  add column if not exists diagnosis_result_type text null;

alter table public.free_reading_requests
  add column if not exists diagnosed_at timestamptz null;

-- 鑑定コードの重複防止用UNIQUE制約。
-- フォーマット(桁数・数字のみ等)のCHECK制約は設けない。将来コード体系が
-- 変更される可能性があるため、フォーマット検証はアプリ層(validation.ts)のみで行う。
-- PostgreSQLのUNIQUE制約はNULL同士を重複とみなさないため、
-- 手動登録などでdiagnosis_codeが未入力(NULL)のレコードが複数あっても衝突しない。
alter table public.free_reading_requests
  drop constraint if exists free_reading_requests_diagnosis_code_key;
alter table public.free_reading_requests
  add constraint free_reading_requests_diagnosis_code_key unique (diagnosis_code);

comment on column public.free_reading_requests.diagnosis_code is
  '診断Webアプリが発行する鑑定コード(将来自動発行。手動登録時はNULL可、UNIQUE制約あり。フォーマット検証はアプリ層で実施)';
comment on column public.free_reading_requests.diagnosis_theme is
  '診断テーマの内部値(money/love/work/relationships/other)。将来の追加を考慮しCHECK制約なし';
comment on column public.free_reading_requests.diagnosis_result_type is
  '診断Webアプリが表示した診断結果タイプの名称(未確定のため自由文字列、CHECK制約なし)';
comment on column public.free_reading_requests.diagnosed_at is
  'Web診断を完了した日時(application_date=無料鑑定申込日、created_at=CRM登録日時とは別役割、NULL許可)';

-- statusのCHECK制約を拡張し、診断Webアプリ連携後の進行管理ステータスを追加する。
-- 既存値は削除しない(既存の公開フォーム・既存データへの影響を避けるため)。
alter table public.free_reading_requests
  drop constraint if exists free_reading_requests_status_check;
alter table public.free_reading_requests
  add constraint free_reading_requests_status_check
    check (status in (
      -- 既存ステータス(変更なし)
      'new',
      'contacted',
      'converted',
      'archived',
      -- 診断Webアプリ連携後の進行管理ステータス(今回追加)
      'diagnosis_completed',
      'awaiting_line_registration',
      'awaiting_free_reading',
      'in_reading',
      'free_reading_sent',
      'paid_reading_proposed',
      'completed'
    ));
