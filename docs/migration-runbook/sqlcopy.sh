#!/bin/bash
# マイグレーション作業用: 指定したSQLをMacのクリップボードへコピーする(実行はしない)
#   bash docs/migration-runbook/sqlcopy.sh <手順名>           … コピー
#   bash docs/migration-runbook/sqlcopy.sh <手順名> --print   … 画面へ表示(確認用)
# 手順名:
#   NNNN-body / NNNN-pre / NNNN-post   … supabase/migrations/NNNN_*.sql の本体・実行前確認・実行後確認
#                                         (本体は毎回ファイルから取り出す。begin; の無い古いファイルは begin;〜commit; で囲む)
#   phase-a <開始番号> / phase-b / verify-a / verify-b(本番移行のまとめ)
#   0014-delete-test / prod-precheck / backup / backup-check / counts / customers-by-account / 0017-backup / 0017-backup-check / 0019-anon-test / merge-test-check / merge-test-requests / merge-result-check / merge-test-c-status
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
MIG="$HERE/../../supabase/migrations"

file_for() { ls "$MIG"/"$1"_*.sql 2>/dev/null | head -1; }
body() {
  local f; f="$(file_for "$1")"; [ -n "$f" ] || return 0
  if grep -q '^begin;' "$f"; then awk '/^begin;/{f=1} f{print} /^commit;/{exit}' "$f"
  else printf 'begin;\n'; cat "$f"; printf '\ncommit;\n'; fi
}
block() {
  local f; f="$(file_for "$1")"; [ -n "$f" ] || return 0
  awk -v h="$2" 'index($0,h){f=1;next} f&&/^--   /{print substr($0,6);next} f{exit}' "$f"
}
# checks/NNNN_pre.sql・NNNN_post.sql があればそれを使う(結果が1つの select にまとまっている版)。
# 無ければマイグレーションファイル先頭の確認SQLを使う
check_or_block() {
  if [ -f "$HERE/checks/$1_$2.sql" ]; then cat "$HERE/checks/$1_$2.sql"; else block "$1" "$3"; fi
}
# 本番移行用のまとめ(phase-a / phase-b)。1つのトランザクションの中で
#   1) 事前確認(prod_precheck.sql)を実行し、開始番号・前提条件・バックアップの有無が想定と違えば中止
#   2) マイグレーションを順に適用(0007は0010で削除される列の追加のみのため含めない)
#   3) 事前確認をもう一度実行し、適用後の状態が想定と違えば中止(全体が取り消される)
PHASE_A_ORDER="0004 0005 0006 0008 0009 0010 0011 0012 0013 0014 0015 0016 0017"
precheck_expr() { sed -e '$ s/;[[:space:]]*$//' "$HERE/prod_precheck.sql"; }
body_inner() {
  local f; f="$(file_for "$1")"
  if grep -q '^begin;' "$f"; then awk '/^begin;/{f=1;next} /^commit;/{exit} f{print}' "$f"; else cat "$f"; fi
}
guard() {
  # $1=フェーズ名 $2=条件(plpgsqlの式。r に事前確認の結果) $3=中止時のメッセージ(%に結果を入れる) $4=メッセージに入れる値
  cat <<GUARD
do \$guard\$
declare r record;
begin
  execute \$pre\$
$(precheck_expr)
  \$pre\$ into r;
  if not ($2) then
    raise exception '$1: $3。何も変更していません', $4;
  end if;
end;
\$guard\$;
GUARD
}
phase_a() {
  local start="$1" started=0 n
  [[ " $PHASE_A_ORDER " == *" $start "* ]] || { echo "phase-a の開始番号は次のいずれか: $PHASE_A_ORDER" >&2; exit 1; }
  echo "-- 本番移行 phase-a(開始番号 $start → 0017)。1つのトランザクションで適用し、想定と違えば全体を取り消す"
  echo "begin;"
  echo "-- バックアップが取得済みであること"
  echo "do \$\$ begin if to_regclass('backup_before_prod_migration.customers') is null then raise exception 'PHASE_A_NO_BACKUP: バックアップ(backup_before_prod_migration)がありません。何も変更していません'; end if; end \$\$;"
  guard PHASE_A_START_MISMATCH "r.next_migration = '$start'" "実際の次の番号は %(指定: $start)" "r.next_migration"
  guard PHASE_A_BLOCKED "r.ready" "%" "r.blockers"
  for n in $PHASE_A_ORDER; do
    [ "$n" = "$start" ] && started=1
    [ $started = 1 ] || continue
    echo; echo "-- ==================== $n ===================="; body_inner "$n"
  done
  echo; echo "-- ==================== 適用後の確認 ===================="
  guard PHASE_A_RESULT_UNEXPECTED "r.next_migration = '0018'" "適用後の次の番号が % になりました(想定 0018)" "r.next_migration"
  echo "commit;"
}
phase_b() {
  echo "-- 本番移行 phase-b(0017の再実行 → 0018 → 0019)。新アプリのデプロイ後に実行する。想定と違えば全体を取り消す"
  echo "begin;"
  echo "do \$\$ begin if to_regclass('backup_before_prod_migration.customers') is null then raise exception 'PHASE_B_NO_BACKUP: バックアップがありません。何も変更していません'; end if; end \$\$;"
  guard PHASE_B_NOT_READY "r.next_migration in ('0017', '0018') and r.state_consistent" "phase-a が完了していません(次の番号 %)" "r.next_migration"
  for n in 0017 0018 0019; do echo; echo "-- ==================== $n ===================="; body_inner "$n"; done
  echo; echo "-- ==================== 適用後の確認 ===================="
  guard PHASE_B_RESULT_UNEXPECTED "r.next_migration = 'none'" "適用後の次の番号が % になりました(想定 none)" "r.next_migration"
  echo "commit;"
}
verify() {
  # $1=想定する次の番号
  cat <<VERIFY
-- 適用後の確認(読み取りのみ)。ok = true なら次へ進んでよい
with r as (
$(precheck_expr)
)
select
  (r.next_migration = '$1' and r.state_consistent and $(cat "$HERE/verify_counts.sql") = '') as ok,
  r.next_migration, r.applied,
  $(cat "$HERE/verify_counts.sql") as tables_with_fewer_rows_than_backup,
  r.customers_total, r.requests_total
from r;
VERIFY
}
sql_for() {
  case "$1" in
    [0-9][0-9][0-9][0-9]-body) body "${1%-body}" ;;
    [0-9][0-9][0-9][0-9]-pre)  check_or_block "${1%-pre}" pre "【実行前の確認】" ;;
    [0-9][0-9][0-9][0-9]-post) check_or_block "${1%-post}" post "実行後の確認(読み取りのみ" ;;
    0014-delete-test)     cat "$HERE/checks/0014_delete_test.sql" ;;
    prod-precheck)        cat "$HERE/prod_precheck.sql" ;;
    phase-a)              phase_a "${ARG:-}" ;;
    phase-b)              phase_b ;;
    verify-a)             verify 0018 ;;
    verify-b)             verify none ;;
    backup)               cat "$HERE/backup_before_migration.sql" ;;
    backup-check)         cat "$HERE/backup_check.sql" ;;
    counts)               cat "$HERE/counts.sql" ;;
    customers-by-account) cat "$HERE/customers_by_account.sql" ;;
    0017-backup)          cat "$HERE/0017_backup.sql" ;;
    0017-backup-check)    cat "$HERE/0017_backup_check.sql" ;;
    0019-anon-test)       cat "$HERE/0019_anon_test.sql" ;;
    merge-test-check)     cat "$HERE/merge_test_check.sql" ;;
    merge-test-requests)  cat "$HERE/merge_test_requests.sql" ;;
    merge-result-check)   cat "$HERE/merge_result_check.sql" ;;
    merge-test-c-status)  cat "$HERE/merge_test_c_status.sql" ;;
    *) echo "不明な手順名です: $1" >&2; exit 1 ;;
  esac
}
STEP="${1:-}"
ARG=""
if [ "$STEP" = "phase-a" ]; then ARG="${2:-}"; shift || true; [ -n "$ARG" ] || { echo "使い方: sqlcopy.sh phase-a <prod-precheck の next_migration の番号>" >&2; exit 1; }; fi
OUT="$(sql_for "$STEP")"
[ -n "$OUT" ] || { echo "SQLを取り出せませんでした(このファイルに該当の確認SQLがありません): $STEP" >&2; exit 1; }
if [ "${2:-}" = "--print" ] || [ "${3:-}" = "--print" ]; then printf '%s\n' "$OUT"; exit 0; fi
printf '%s\n' "$OUT" | pbcopy
if [ "$(pbpaste)" = "$OUT" ]; then
  echo "コピーしました: $STEP($(printf '%s\n' "$OUT" | wc -l | tr -d ' ')行)。Supabaseの SQL Editor に貼り付けてください。"
else
  echo "コピーに失敗しました: $STEP" >&2; exit 1
fi
