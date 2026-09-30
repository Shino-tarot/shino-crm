-- free_reading_requests: 診断Webアプリ連携機能の撤去(DB側)
--
-- 【承認済み】2026-09-30 オーナー承認済み。
-- ただし、このファイルはまだSupabase SQL Editorで実行していません。
-- 実行はオーナーが明示的に指示したタイミングで行うこと。
--
-- 【調査結果】(2026-09-30時点)
--   1. diagnosis_code / diagnosis_theme / diagnosis_result_type は
--      全68件とも未使用(NULLのみ)だった。削除してもデータ消失なし。
--   2. diagnosed_at のみ2件だけ値が入っていたが(他66件はNULL)、
--      いずれもdiagnosis_code/diagnosis_theme/diagnosis_result_typeは未入力で、
--      診断Webアプリ経由の実データではなかった。オーナー承認により削除対象に含める。
--        id = d421364a-c02d-4a2d-8ec1-d642520bd47d  diagnosed_at = 2026-09-02T05:25:00+00:00
--        id = 29e18ab9-602d-4ae2-ab78-a8c912a8d50a  diagnosed_at = 2026-09-06T08:34:00+00:00
--   3. status = 'diagnosis_completed' / 'awaiting_line_registration' は
--      使用件数0件だった(削除しても既存データへの影響なし)。
--      一方 'awaiting_free_reading' / 'in_reading' / 'free_reading_sent' /
--      'paid_reading_proposed' / 'completed' は診断Webアプリ専用ではなく、
--      CRMの鑑定進行管理として今後も使うため残す。
--
-- ============================================================
-- 1. statusのCHECK制約を、診断Webアプリ専用ステータスを除いて再定義
-- ============================================================
alter table public.free_reading_requests
  drop constraint if exists free_reading_requests_status_check;
alter table public.free_reading_requests
  add constraint free_reading_requests_status_check
    check (status in (
      -- 既存4ステータス(変更なし)
      'new',
      'contacted',
      'converted',
      'archived',
      -- CRMの鑑定進行管理として今後も使うステータス(残す)
      'awaiting_free_reading',
      'in_reading',
      'free_reading_sent',
      'paid_reading_proposed',
      'completed'
      -- 診断Webアプリ専用だった 'diagnosis_completed' /
      -- 'awaiting_line_registration' はここで削除する
    ));

-- ============================================================
-- 2. 鑑定コードのUNIQUE制約を削除
-- ============================================================
alter table public.free_reading_requests
  drop constraint if exists free_reading_requests_diagnosis_code_key;

-- ============================================================
-- 3. 診断Webアプリ専用カラムを削除
-- ============================================================
alter table public.free_reading_requests drop column if exists diagnosis_code;
alter table public.free_reading_requests drop column if exists diagnosis_theme;
alter table public.free_reading_requests drop column if exists diagnosis_result_type;
alter table public.free_reading_requests drop column if exists diagnosed_at;
