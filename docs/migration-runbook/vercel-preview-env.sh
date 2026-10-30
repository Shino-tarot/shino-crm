#!/bin/bash
# Vercel の Preview(作業ブランチ限定)に、検証用DB(shino-crm-test)の接続設定を追加する。
#
# 使い方: macOS の「ターミナル」アプリで実行する(初回は Vercel へのログインをブラウザで求められる)
#   bash ~/Desktop/shino-crm/docs/migration-runbook/vercel-preview-env.sh [ブランチ名(省略時 feat/status-auto-followup)]
#
# - 値は .env.development.local(検証用DBの設定)から読み、画面・ファイル・コマンドライン引数には出さない(標準入力で渡す)
# - 追加するのは「Preview + 指定ブランチ」の変数だけ。Production・既存の変数は変更しない(--force は使わない)
#   ブランチ指定の Preview 変数は、Production と共有の変数より優先される(Vercel の仕様)
# - 実行前後で Production の変数一覧(名前・適用先のみ)を比べ、変わっていないことを確認する
# 必要なもの: Vercel CLI(~/.local/vercel-cli に導入済み。別の場所なら VERCEL_BIN で指定)

set -euo pipefail
umask 077
cd "$(dirname "$0")/../.."
V="${VERCEL_BIN:-$HOME/.local/vercel-cli/node_modules/.bin/vercel}"
BRANCH="${1:-feat/status-auto-followup}"
[ -x "$V" ] || { echo "Vercel CLI が見つかりません: $V"; exit 1; }
[ "$BRANCH" != "main" ] || { echo "main には設定しません(本番ブランチ)"; exit 1; }
[ -f .env.development.local ] && [ -f .env.local ] || { echo ".env.development.local / .env.local が見つかりません"; exit 1; }

# KEY=VALUE を読む(前後の引用符・CRを除く)。値は変数に入れるだけで表示しない
env_value() { # $1=ファイル $2=キー
  local v; v="$(grep -E "^$2=" "$1" | tail -1 | cut -d= -f2- | tr -d '\r')"
  v="${v#\"}"; v="${v%\"}"; v="${v#\'}"; v="${v%\'}"; printf '%s' "$v"
}
KEYS="NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY CRM_ADMIN_EMAILS NEXT_PUBLIC_CRM_DB_LABEL"
for k in $KEYS; do
  [ -n "$(env_value .env.development.local "$k")" ] || { echo ".env.development.local に $k がありません"; exit 1; }
done
TEST_URL="$(env_value .env.development.local NEXT_PUBLIC_SUPABASE_URL)"
[[ "$TEST_URL" =~ ^https://[a-z0-9]{20}\.supabase\.co/?$ ]] || { echo "検証用DBのURLの形式が想定と違います"; exit 1; }
# 本番(.env.local)と同じ値が入っていたら中止する(検証用DBのつもりで本番を設定してしまうことを防ぐ)
for k in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY; do
  [ "$(env_value .env.development.local "$k")" != "$(env_value .env.local "$k")" ] || { echo "$k が本番(.env.local)と同じです。中止します"; exit 1; }
done
REF="$(echo "$TEST_URL" | sed -E 's#https://([a-z0-9]+)\..*#\1#')"

echo "[1/4] Vercel へのログインを確認しています..."
"$V" whoami >/dev/null 2>&1 || "$V" login
echo "[2/4] プロジェクトとの紐づけを確認しています..."
[ -f .vercel/project.json ] || "$V" link
PROJECT="$(sed -nE 's/.*"projectName" *: *"([^"]+)".*/\1/p' .vercel/project.json)"
echo "      プロジェクト: ${PROJECT:-(名前不明)} / ブランチ: $BRANCH / 検証用DB: ${REF:0:4}…"
read -r -p "この内容で Preview($BRANCH)に追加します。よろしければ y を入力: " ok
[ "$ok" = "y" ] || { echo "中止しました(何も変更していません)"; exit 1; }

# Production の一覧(名前・適用先。値は Encrypted 表示で、--json は使わない)。経過時間の列は比較から除く
prod_list() { "$V" env ls --environment production 2>/dev/null | sed -E 's/[0-9]+[smhdwy] ago//; s/[[:space:]]+$//' | grep -v -E '^(Vercel CLI|>|Retrieving)' || true; }
BEFORE="$(prod_list)"
[[ "$BEFORE" == *NEXT_PUBLIC_SUPABASE_URL* ]] || { echo "Production の変数一覧を取得できませんでした。中止します(何も変更していません)"; exit 1; }

echo "[3/4] Preview($BRANCH)に追加しています..."
for k in $KEYS; do
  type=--sensitive; [ "$k" = NEXT_PUBLIC_CRM_DB_LABEL ] && type=--no-sensitive
  if env_value .env.development.local "$k" | "$V" env add "$k" --environment preview --git-branch "$BRANCH" "$type" >/dev/null 2>"${TMPDIR:-/tmp}/vercel-env-add.err"; then
    echo "      追加: $k"
  else
    echo "      失敗: $k(既に同じブランチ用の値がある場合は、Vercel の画面で確認してください)"
    sed -E 's/(ey|sb_)[A-Za-z0-9._-]{10,}/[省略]/g' "${TMPDIR:-/tmp}/vercel-env-add.err" | tail -3
    rm -f "${TMPDIR:-/tmp}/vercel-env-add.err"; exit 1
  fi
done
rm -f "${TMPDIR:-/tmp}/vercel-env-add.err"

echo "[4/4] 確認しています..."
AFTER="$(prod_list)"
if [ "$BEFORE" = "$AFTER" ]; then echo "      Production の変数: 変更なし"; else echo "      Production の変数一覧が変わっています。Vercel の画面で確認してください"; exit 1; fi
"$V" env ls --environment preview --git-branch "$BRANCH" 2>/dev/null | grep -E "$(echo $KEYS | tr ' ' '|')" || true
echo
echo "完了: Preview($BRANCH)は検証用DB(${REF:0:4}…)を使います。反映は次の push から"
