#!/bin/bash
# 本番DB(Supabase)の外部バックアップを Mac に保存し、空のローカルDBへの復元テストまで行う。
#
# 使い方: macOS の「ターミナル」アプリで実行する(パスワードを Claude Code に渡さないため)
#   bash ~/Desktop/shino-crm/docs/migration-runbook/backup-prod-to-mac.sh
#
# - 本番DBには読み取りしか行わない(pg_dump と、読み取り専用トランザクションでの件数の取得のみ)
# - 対象: public スキーマ(顧客・無料鑑定申込・関連テーブルのデータ、テーブル定義・制約・関数・トリガー・ポリシー・権限)
#   ※ auth(ログイン用ユーザー)・storage など Supabase 管理のスキーマは含めない
# - 保存先: ~/shino-crm-backups/<日時>/(iCloud で同期されない場所。フォルダは本人のみ読み書き可)
# - 接続文字列のパスワード部分とパスワードは画面・ファイルに出さない
# - 復元テストは一時的なローカルDB(このMacの中だけ)で行い、終了後に削除する
# 必要なもの: PostgreSQL 17 のコマンド(Postgres.app をアプリケーションフォルダに入れる)

set -euo pipefail
umask 077

# ---------- PostgreSQL のコマンドを探す ----------
BIN=""
for dir in "${PG_BIN:-}" /Applications/Postgres.app/Contents/Versions/17/bin "$HOME/.local/postgresql-17/bin" \
           /Applications/Postgres.app/Contents/Versions/latest/bin; do
  if [ -n "$dir" ] && [ -x "$dir/pg_dump" ]; then BIN="$dir"; break; fi
done
[ -n "$BIN" ] || { echo "PostgreSQL のコマンドが見つかりません。Postgres.app(17)を /Applications に入れてから実行してください。"; exit 1; }
for tool in pg_dump pg_restore psql initdb pg_ctl; do
  [ -x "$BIN/$tool" ] || { echo "$tool が見つかりません($BIN)"; exit 1; }
done
TOOL_MAJOR="$("$BIN/pg_dump" --version | sed -E 's/[^0-9]*([0-9]+).*/\1/')"

# ---------- 保存先 ----------
ROOT="${SHINO_BACKUP_DIR:-$HOME/shino-crm-backups}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DIR="$ROOT/$STAMP"
mkdir -p "$DIR"
chmod 700 "$ROOT" "$DIR"
case "$DIR" in
  "$HOME/Desktop"*|"$HOME/Documents"*|*"Mobile Documents"*)
    echo "iCloud で同期される場所には保存しません: $DIR"; exit 1 ;;
esac

# ---------- 接続情報(画面に出さない) ----------
if [ -z "${BACKUP_CONNINFO:-}" ]; then
  echo "Supabase の「Connect」→「Session pooler」の接続文字列(postgresql://...)を貼り付けて Enter を押してください。"
  echo "(パスワードの部分は [YOUR-PASSWORD] のままで構いません。入力内容は画面に表示されません)"
  read -rs CONN; echo
else
  CONN="$BACKUP_CONNINFO"
fi
# 貼り付け時に混ざる改行(CR)・空白・タブ・貼り付けの目印(ESC[200~ / ESC[201~)を取り除く
# (末尾に残るとデータベース名の一部として送られ、Supabase の pooler が "Invalid format for user or db_name" で拒否する)
strip_paste() { local s="${1//$'\e'\[200~/}"; s="${s//$'\e'\[201~/}"; printf '%s' "$s" | LC_ALL=C tr -d '\000-\040\177'; }
CONN="$(strip_paste "$CONN")"
# postgresql://ユーザー[:パスワード]@ホスト[:ポート][/DB名][?…] に分解する。パスワード部分は使わずに捨てる
# (パスワードに @ が含まれても良いよう、最後の @ で区切る。? 以降の追加設定は使わない)
[[ "$CONN" =~ ^postgres(ql)?://(.+)@([^@]+)$ ]] || { echo "接続文字列の形式が正しくありません(postgresql:// で始まる文字列を貼り付けてください)"; exit 1; }
DB_USER="${BASH_REMATCH[2]%%:*}"; REST="${BASH_REMATCH[3]%%\?*}"
HOSTPORT="${REST%%/*}"; DB_NAME="postgres"
[ "$HOSTPORT" != "$REST" ] && [ -n "${REST#*/}" ] && DB_NAME="${REST#*/}"
DB_HOST="${HOSTPORT%%:*}"; DB_PORT="5432"
[ "$DB_HOST" != "$HOSTPORT" ] && DB_PORT="${HOSTPORT#*:}"
[[ "$DB_USER" =~ ^[A-Za-z0-9_.-]+$ ]] || { echo "接続文字列のユーザー名の形式が正しくありません"; exit 1; }
[[ "$DB_HOST" =~ ^[A-Za-z0-9.-]+$ ]] || { echo "接続文字列のホスト名の形式が正しくありません"; exit 1; }
[[ "$DB_PORT" =~ ^[0-9]+$ ]] || { echo "接続文字列のポート番号の形式が正しくありません"; exit 1; }
[[ "$DB_NAME" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "接続文字列のデータベース名の形式が正しくありません"; exit 1; }
# Session pooler はユーザー名が「postgres.<プロジェクトID>」でないと接続先のプロジェクトを判別できない
if [[ "$DB_HOST" == *.pooler.supabase.com ]] && ! [[ "$DB_USER" =~ ^[a-z_]+\.[a-z0-9]+$ ]]; then
  echo "Session pooler のユーザー名は「postgres.<プロジェクトID>」の形式です。「Connect」→「Session pooler」の文字列を貼り付け直してください"; exit 1
fi
USER_SHOWN="$DB_USER"
if [[ "$DB_USER" == *.* ]]; then  # プロジェクトIDは先頭4文字だけ表示する
  PROJECT_REF="${DB_USER#*.}"; USER_SHOWN="${DB_USER%%.*}.${PROJECT_REF:0:4}…(プロジェクトID ${#PROJECT_REF}文字)"
fi
echo "接続先: $DB_HOST:$DB_PORT / DB名 $DB_NAME / ユーザー $USER_SHOWN"
# psql・pg_dump にはキーワード形式で渡す(URIの解釈の違いや余計な設定が入らないように)
CONN="host=$DB_HOST port=$DB_PORT user=$DB_USER dbname=$DB_NAME"
if [ -z "${PGPASSWORD:-}" ]; then
  read -rs -p "データベースのパスワード(入力は表示されません): " PGPASSWORD; echo
fi
PGPASSWORD="${PGPASSWORD//$'\e'\[200~/}"; PGPASSWORD="${PGPASSWORD//$'\e'\[201~/}"; PGPASSWORD="${PGPASSWORD%$'\r'}"
[ -n "$PGPASSWORD" ] || { echo "パスワードが空です"; exit 1; }
export PGPASSWORD PGCONNECT_TIMEOUT=20 PGSSLMODE="${PGSSLMODE:-require}"

TMP=""
cleanup() {
  unset PGPASSWORD
  if [ -n "$TMP" ] && [ -d "$TMP" ]; then
    "$BIN/pg_ctl" -D "$TMP/data" -m fast stop >/dev/null 2>&1 || true
    rm -rf "$TMP"
  fi
}
trap cleanup EXIT

# 件数と構造の数え方(本番・復元先の両方で同じSQLを使い、結果を比べる)
COUNT_SQL="select c.relname, (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' order by 1"
STRUCT_SQL="select 'tables', count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'
  union all select 'columns', count(*) from information_schema.columns where table_schema = 'public'
  union all select 'constraints', count(*) from pg_constraint where connamespace = 'public'::regnamespace
  union all select 'indexes', count(*) from pg_indexes where schemaname = 'public'
  union all select 'functions', count(*) from pg_proc p where p.pronamespace = 'public'::regnamespace
    and not exists (select 1 from pg_depend d where d.classid = 'pg_proc'::regclass and d.objid = p.oid and d.deptype = 'e')
  union all select 'triggers', count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not t.tgisinternal
  union all select 'policies', count(*) from pg_policies where schemaname = 'public'
  order by 1"
run_readonly() { # $1=接続先 $2=SQL … 読み取り専用トランザクションで実行し、タブ区切りで出力
  "$BIN/psql" "$1" -X -A -t -F $'\t' -v ON_ERROR_STOP=1 -q \
    -c "begin transaction read only" -c "$2" -c "commit" | sed '/^$/d'
}

echo "[1/6] 本番DBに接続しています(読み取りのみ)..."
SERVER_MAJOR="$("$BIN/psql" "$CONN" -X -A -t -q -v ON_ERROR_STOP=1 -c "show server_version_num" | head -1 | cut -c1-2)"
if [ "$SERVER_MAJOR" -gt "$TOOL_MAJOR" ]; then
  echo "本番のPostgreSQL($SERVER_MAJOR)が手元のツール($TOOL_MAJOR)より新しいため中止します。新しい版の Postgres.app を入れてください。"; exit 1
fi
run_readonly "$CONN" "$COUNT_SQL" > "$DIR/prod_counts.tsv"
run_readonly "$CONN" "$STRUCT_SQL" > "$DIR/prod_structure.tsv"
echo "      本番 PostgreSQL $SERVER_MAJOR / テーブル $(wc -l < "$DIR/prod_counts.tsv" | tr -d ' ') 個"

echo "[2/6] バックアップを取得しています(pg_dump)..."
DUMP="$DIR/shino-crm-public.dump"
"$BIN/pg_dump" "$CONN" --format=custom --schema=public --file="$DUMP" --no-password
chmod 600 "$DUMP" "$DIR"/*.tsv

echo "[3/6] ファイルを検証しています..."
[ -s "$DUMP" ] || { echo "バックアップファイルが空です"; exit 1; }
(cd "$DIR" && shasum -a 256 "$(basename "$DUMP")" > "$(basename "$DUMP").sha256" && shasum -a 256 -c "$(basename "$DUMP").sha256" >/dev/null)
"$BIN/pg_restore" --list "$DUMP" > "$DIR/contents.txt"
"$BIN/pg_restore" --file=/dev/null "$DUMP"   # 全データを最後まで読めるか(壊れていないか)
TABLE_DATA="$(grep -c ' TABLE DATA public ' "$DIR/contents.txt" || true)"
PROD_TABLES="$(wc -l < "$DIR/prod_counts.tsv" | tr -d ' ')"
[ "$TABLE_DATA" = "$PROD_TABLES" ] || { echo "バックアップ内のテーブル数($TABLE_DATA)が本番($PROD_TABLES)と違います"; exit 1; }
chmod 600 "$DIR"/*

echo "[4/6] 空のローカルDBを用意しています(このMacの中だけ・一時的)..."
TMP="$(mktemp -d "${TMPDIR:-/tmp}/shino-restore-test.XXXXXX")"
PORT="${RESTORE_TEST_PORT:-54329}"
"$BIN/initdb" -D "$TMP/data" -U postgres -A trust --no-sync >/dev/null
"$BIN/pg_ctl" -D "$TMP/data" -l "$TMP/server.log" -w \
  -o "-p $PORT -k $TMP -c listen_addresses='' -c fsync=off" start >/dev/null
LOCAL="host=$TMP port=$PORT user=postgres dbname=postgres"
# Supabase と同じロール・拡張機能を用意し、空の public スキーマに復元する
"$BIN/psql" "$LOCAL" -X -q -v ON_ERROR_STOP=1 <<'SQL' >/dev/null
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema extensions;
create extension if not exists pgcrypto schema extensions;
create extension if not exists "uuid-ossp" schema extensions;
drop schema public cascade;
SQL

echo "[5/6] バックアップを復元しています..."
"$BIN/pg_restore" --dbname="$LOCAL" --no-owner --no-privileges --exit-on-error "$DUMP"

echo "[6/6] 本番と復元結果を比べています..."
run_readonly "$LOCAL" "$COUNT_SQL" > "$TMP/restored_counts.tsv"
run_readonly "$LOCAL" "$STRUCT_SQL" > "$TMP/restored_structure.tsv"
COUNTS_OK=no; STRUCT_OK=no
diff -q "$DIR/prod_counts.tsv" "$TMP/restored_counts.tsv" >/dev/null && COUNTS_OK=yes
diff -q "$DIR/prod_structure.tsv" "$TMP/restored_structure.tsv" >/dev/null && STRUCT_OK=yes

echo
echo "================ バックアップの結果 ================"
echo "保存先        : $DIR"
echo "ファイル      : $(basename "$DUMP")($(du -h "$DUMP" | cut -f1 | tr -d ' '))"
echo "SHA-256       : $(cut -d' ' -f1 "$DUMP.sha256")"
echo "テーブル数    : $PROD_TABLES / 行数合計: $(awk -F'\t' '{s+=$2} END {print s}' "$DIR/prod_counts.tsv")"
echo "件数の一致    : $COUNTS_OK(本番とローカル復元)"
echo "構造の一致    : $STRUCT_OK(テーブル・列・制約・索引・関数・トリガー・ポリシーの数)"
awk -F'\t' '{printf "  %-24s %s\n", $1, $2}' "$DIR/prod_counts.tsv"
if [ "$COUNTS_OK" = yes ] && [ "$STRUCT_OK" = yes ]; then
  echo "判定          : OK(このファイルから復元できることを確認しました)"
else
  echo "判定          : NG(件数または構造が一致しません。phase-a に進まず、この結果を共有してください)"
  diff "$DIR/prod_structure.tsv" "$TMP/restored_structure.tsv" || true
  exit 1
fi
