# 本番移行チェックリスト（0004〜0019・鯛子／夜宵のアカウント分離）

## 進捗（2026-10-30 時点）— 次回はここから再開
| 工程 | 状態 |
|---|---|
| 検証用DB（shino-crm-test）への 0012〜0019 適用・ブラウザ確認・顧客統合テスト | 完了 |
| ローカルのテスト（単体63・DB63）、lint、型チェック、`next build` | 完了（すべて成功） |
| 1. 本番の事前確認 `prod-precheck` | **完了**：`next_migration`=**0011**、`ready`=true、blockers なし、`state_consistent`=true、`customers_total`=104、`requests_total`=151、その他の問題項目はすべて0 |
| 2. 本番のDB内バックアップ `backup` → `backup-check` | **完了**：`ok`=true（スキーマ `backup_before_prod_migration`） |
| 2'. 本番の外部バックアップ（Macへの保存＋復元テスト） | **完了**（結果は次の行）。2026-10-30 に Postgres.app 2.9.6（PostgreSQL 17.11、SHA-256・公証確認済み）を /Applications に導入。`backup-prod-to-mac.sh` をローカルの模擬本番DB（0001〜0010適用・SSL接続）で予行演習し「判定：OK」、模擬本番側への書き込みが無いこと（ログで確認）、想定外の設定がある場合は OK を出さずに止まることを確認済み。同日の本番での初回実行は pooler が `Invalid format for user or db_name` で拒否（接続文字列の末尾の空白・改行がDB名に混入しうる不具合）→ 貼り付け時の空白・改行の除去と、ユーザー名・ホスト・DB名の分解・検証を追加して修正（ローカルで再検証済み） |
| 2'（結果） | **完了**（2026-10-30）：判定 OK、`~/shino-crm-backups/20261030-151941/`。顧客110・申込156・有料鑑定9（DB内バックアップ取得時から顧客+6・申込+5） |
| 3. phase-a 0011 | **完了**（2026-10-30、本番で Success → `verify-a` ok=true をオーナーが確認）。事前の2026-10-30 に上記の外部バックアップを一時ローカルDB（PostgreSQL 17）へ復元して予行演習：事前確認 ready=true・blockers なし → phase-a 0011 Success → verify-a ok=true、既存データ（全行・既存列・updated_at）不変、旧アプリ相当の登録・更新OK、顧客の物理削除は拒否、バックアップ無し／再実行時は中止されることを確認。SQLの修正は不要 |
| 4-1. Vercel の Production 環境変数 | **確認済み**（2026-10-30、オーナー）：必須4つ・`NEXT_PUBLIC_LINE_URL`/`_TAIKO` あり、`NEXT_PUBLIC_CRM_DB_LABEL` なし。`NEXT_PUBLIC_SITE_URL` は未設定だったため追加（LPのOGP画像の絶対URL用。CRMの動作には不要） |
| 4-1'. Preview の安全対策 | **完了**：Preview の環境変数は Production と共有（本番DBを指す）ため、`src/lib/supabase/databaseTargetGuard.ts` を追加。Preview（`VERCEL_ENV=preview`）で `NEXT_PUBLIC_CRM_DB_LABEL` が無ければDBクライアントの作成時にエラーにし、**ビルドの時点で失敗する**（本番DBに接続するPreviewは公開されない）。Production・ローカルは影響なし（ビルドで確認済み） |
| 4-1''. Preview を検証用DBで動かす（任意） | 未実施：`vercel-preview-env.sh` で作業ブランチ限定の Preview 変数（検証用DB）を追加できる（要 Vercel ログイン。Production の変数は変更しない）。Vercel CLI 65.8.0 は `~/.local/vercel-cli` に導入済み |
| 4-2. コミット | **完了**（2026-10-30、ローカルのみ。push していない） |
| 4-2'. push → main 反映（本番デプロイ） | 未実施（オーナーの許可待ち） |
| 5. phase-b・6. 本番での確認 | 未実施（新アプリのデプロイ後、「6. 本番での確認」A〜C が問題なければすぐ実行） |

本番 Supabase は Free プランのため、管理画面の自動バックアップは利用できない（確認済み）。

### 次回の再開手順（本番公開まで）
1. オーナーの許可後、作業ブランチを main へ反映して本番デプロイ: `git push origin feat/status-auto-followup:main`
   （origin/main からの早送り。作業ブランチ自体は push しないため Preview は作られない）
2. Vercel の Production デプロイ成功 → 本番画面で「6. 本番での確認」A〜C
3. 問題なければすぐ phase-b（`sqlcopy.sh phase-b`）→ `verify-b` → `0019-anon-test` → 6. の D・E
   - phase-a 後〜phase-b の間に旧アプリで登録された行は account_id が空のため、新アプリでは phase-b まで表示されない（phase-b で鯛子へ振り分ける）
- 外部バックアップの取り直し（任意）: macOS の「ターミナル」で `bash ~/Desktop/shino-crm/docs/migration-runbook/backup-prod-to-mac.sh`
  （接続文字列は「Connect」→「Session pooler」。パスワードは画面に出ない。保存先 `~/shino-crm-backups/<日時>/`）
- プロジェクトはデスクトップ（iCloud 同期）にあるため、Finder で「ダウンロードを削除」等をしないこと

SQLはすべて **Supabase の SQL Editor でオーナーが手動実行**する（Claude は本番DBに接続しない）。
SQLのコピー（実行はしない。Claude Code の入力欄で実行）:

```
! bash /Users/kanehamasaki/Desktop/shino-crm/docs/migration-runbook/sqlcopy.sh <手順名>
```

## 安全の仕組み
- `phase-a` / `phase-b` は **1つのトランザクション**。最初に事前確認を自動で実行し、
  **バックアップが無い／開始番号が実際と違う／前提条件(blockers)がある** 場合は何も変更せずに中止する。
  最後にもう一度確認し、適用後の状態が想定と違えば **全体を取り消す**。
- 確認SQL（`prod-precheck` `backup-check` `verify-a` `verify-b`）は1行の結果で、`ready` / `ok` が true かだけを見ればよい。
- 開始番号は推測しない。`prod-precheck` の `next_migration` をそのまま `phase-a` に渡す（違えば中止される）。
- 0004〜0010（`begin;` の無い古いファイル）も phase-a のトランザクションに含まれる。0007 は 0010 で削除される列の追加だけのため含めない。
- この手順は `tests/db/productionRunbook.test.mjs` で、本番がありうる各状態から通しで検証している。

---

## 1. 準備（本番への変更なし）
| # | 操作 | 次に進む条件 |
|---|---|---|
| 1-1 | Supabase で **本番プロジェクト** を開いていることを確認（以降すべて本番） | — |
| 1-2 | `prod-precheck`（読み取りのみ） | `ready` = **true**。`next_migration` を控える（例: 0012）。`customers_total` / `requests_total` を控える |
| 1-3 | Database → Backups で、管理画面のバックアップの有無・日時を確認（プランにより異なる） | 確認できればよい（無い場合も 1-4 のバックアップで進められる） |

`ready` = false のときは `blockers` の内容を共有して相談（この先へ進まない）。

## 2. バックアップ（本番に「別スキーマへのコピー」を作る。既存データは変更しない）
| # | 操作 | 次に進む条件 |
|---|---|---|
| 2-1 | `backup` | 「Success」 |
| 2-2 | `backup-check`（読み取りのみ） | `ok` = **true**（全テーブルの件数と内容のハッシュが一致＝復元に使える） |

## 3. phase-a（旧アプリのままで適用できる 0004〜0017）
| # | 操作 | 次に進む条件 |
|---|---|---|
| 3-1 | `phase-a <1-2の next_migration>`（例: `phase-a 0012`） | 「Success」（エラーなら何も変わっていない → エラー文を共有） |
| 3-2 | `verify-a`（読み取りのみ） | `ok` = **true**（`next_migration` = 0018） |

phase-a の後、旧アプリの顧客「削除」ボタンはエラーになる（0014。データは守られる）。それ以外は旧アプリのまま使える。

## 4. 新アプリのデプロイ
**phase-a（3-2 が ok）より前に main へ反映しない**（main は本番に自動デプロイされる想定。新アプリは account_id が必要）。

| # | 操作 | 次に進む条件 |
|---|---|---|
| 4-1 | Vercel の Production 環境変数を確認（下表）。値は表示しない | 必須がそろっている、`NEXT_PUBLIC_CRM_DB_LABEL` が **無い** |
| 4-2 | ローカルでコミット → 作業ブランチを push → main へマージ（または main へ push） | Vercel の Production デプロイが成功 |
| 4-3 | 本番画面で「6. 本番での確認」の A〜C | すべて問題なし |

| 環境変数 | Production | 備考 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | 必須 | 本番のSupabase |
| `CRM_ADMIN_EMAILS` | 必須 | ログインできる管理者 |
| `NEXT_PUBLIC_LINE_URL` / `NEXT_PUBLIC_LINE_URL_TAIKO` | 既存どおり | 公開ページのLINEボタンのリンク |
| `NEXT_PUBLIC_SITE_URL` | 推奨（2026-10-30 追加） | 本番のURL（`https://…`、末尾の `/` なし）。未設定だと /taiko・/shino の OGP 画像が `http://localhost:3000/…` になる。CRMの動作には不要 |
| `LINE_CHANNEL_SECRET` / `LINE_CHANNEL_ACCESS_TOKEN` | 本番でLINE受信を使う場合のみ | 未設定なら Webhook は 503（受信しない）。LINE設定は今回変更しない |
| `NEXT_PUBLIC_CRM_DB_LABEL` | **設定しない** | 検証用DBの帯を出すための目印 |

今回の変更で新しく必要になった環境変数は無い。
Preview は Production と環境変数を共有している（本番DBを指す）。`NEXT_PUBLIC_CRM_DB_LABEL` が無い Preview はビルドで失敗するようにしてある（`databaseTargetGuard.ts`）。
Preview を動かす場合は `bash ~/Desktop/shino-crm/docs/migration-runbook/vercel-preview-env.sh` で、作業ブランチ限定の検証用DBの変数5つ（URL・anon・service_role・管理者メール・ラベル）をまとめて追加する。

## 5. phase-b（新アプリのデプロイ後）
| # | 操作 | 次に進む条件 |
|---|---|---|
| 5-1 | `phase-b` | 「Success」（0017〜デプロイの間に旧アプリで登録された行も鯛子へ振り分けてから 0018・0019 を適用する） |
| 5-2 | `verify-b`（読み取りのみ） | `ok` = **true**（`next_migration` = none） |
| 5-3 | `0019-anon-test` | 「permission denied」エラー（anon の直接書き込みが拒否されている） |
| 5-4 | 本番画面で「6. 本番での確認」の A〜E | すべて問題なし |

## 6. 本番での確認
- A. ログインでき、「鯛子のCRMを表示中」の帯が出る。顧客一覧の件数が 1-2 の `customers_total`（非表示を除く）と合う
- B. 「夜宵」に切り替えると0件、「鯛子」に戻すと元どおり
- C. 顧客詳細のタブ（無料鑑定申込・有料鑑定・アップセル・会話履歴）がエラーなく開く。無料鑑定申込の一覧が開く
- D. 公開の申込フォームから送信できる（必要なら名前「本番動作確認」で送信し、確認後にその顧客を非表示にする）
- E. LINE受信の受け口: 署名なしで呼ぶと拒否される（データは書き込まれない）
  `curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<本番のドメイン>/api/line/webhook -d '{}'`
  → `401`（LINE設定あり・署名なしを拒否）または `503`（LINE未設定）なら正常

---

## 停止条件と復旧方針
| 状況 | 対応 |
|---|---|
| `prod-precheck` が ready = false | 進まない。`blockers` を共有して相談 |
| `backup-check` が ok = false | 進まない。`mismatched_tables` を共有 |
| phase-a / phase-b がエラー | トランザクション全体が取り消されて元のまま。エラー文（`PHASE_…` で始まる）を共有 |
| `verify-a` / `verify-b` が ok = false | 次へ進まない。結果を共有 |
| 新アプリに不具合（phase-b 前） | Vercel で直前の Production デプロイへ戻す（Instant Rollback）。phase-a 後でも旧アプリは動く |
| 新アプリに不具合（phase-b 後） | **旧アプリへ戻さない**（旧アプリは account_id を送らないため保存できない）。修正版をデプロイする |
| データに問題が見つかった | `backup_before_prod_migration` に移行前の全データがある。どの行をどう戻すかは相談のうえで行う（0010で削除された診断列もここに残る） |

移行が落ち着いたら、`backup_before_prod_migration` を残すか削除するかはオーナーが判断する（個人情報のコピーを含むため）。
