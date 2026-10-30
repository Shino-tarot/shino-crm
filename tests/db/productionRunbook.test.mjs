// 実行: npm run test:db
// 本番移行の手順書(docs/migration-runbook/sqlcopy.sh が出力するSQLそのもの)を、
// 本番がありうる複数の状態から、メモリ上のPostgreSQL(PGlite)で通しで確かめる。実DBには接続しない。データはダミー。
//   - 事前確認(prod-precheck)が次の番号・前提条件を正しく判定する
//   - phase-a / phase-b は、開始番号の誤り・前提条件の不足・バックアップ未取得なら何も変更せずに中止する
//   - 正しい手順なら 0018・0019 まで適用され、既存データは減らない
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import assert from "node:assert/strict";
import { createTestDb, expectError } from "./helpers.mjs";

const SCRIPT = join(import.meta.dirname, "../../docs/migration-runbook/sqlcopy.sh");
const sql = (...args) => execFileSync("bash", [SCRIPT, ...args, "--print"], { encoding: "utf8" });
const last = async (db, text) => (await db.exec(text)).at(-1).rows[0];
const schemaSnapshot = async (db) =>
  JSON.stringify(
    (await db.query(
      "select table_schema, table_name, column_name, is_nullable from information_schema.columns where table_schema in ('public', 'backup_before_prod_migration') order by 1, 2, 3",
    )).rows,
  );
async function expectAbort(db, text, pattern) {
  const before = await schemaSnapshot(db);
  await expectError(db.exec(text), pattern);
  await db.exec("rollback");
  assert.equal(await schemaSnapshot(db), before, "中止した場合は何も変わらない");
}

// 0011まで適用済み(=0012から)の本番に近い状態。旧アプリと同じ列だけで顧客・申込を入れる
async function stateBefore0012() {
  const db = await createTestDb({ before: "0012" });
  for (let i = 1; i <= 3; i++) {
    const id = (await db.query("insert into customers (reading_name, line_user_id) values ($1, '') returning id", [`既存${i}`])).rows[0].id;
    await db.query("insert into free_reading_requests (customer_id, contact_method, status) values ($1, 'line', 'free_reading_sent')", [id]);
  }
  await db.query("insert into free_reading_requests (contact_method, status) values ('line', 'new')");
  return db;
}

await test("0012からの本番: 事前確認 → バックアップ → phase-a → 旧アプリでの登録 → phase-b → 0019まで適用、件数は減らない", async () => {
  const db = await stateBefore0012();
  const pre = await last(db, sql("prod-precheck"));
  assert.equal(pre.next_migration, "0012");
  assert.equal(pre.ready, true);
  assert.equal(pre.blockers, "");

  await db.exec(sql("backup"));
  const backup = await last(db, sql("backup-check"));
  assert.equal(backup.ok, true);

  await db.exec(sql("phase-a", "0012"));
  const a = await last(db, sql("verify-a"));
  assert.equal(a.ok, true);
  assert.equal(a.next_migration, "0018");

  // phase-a 〜 新アプリのデプロイの間に旧アプリで登録された行(アカウント空欄)
  await db.query("insert into customers (reading_name) values ('旧アプリで追加')");
  assert.equal((await last(db, sql("prod-precheck"))).next_migration, "0017");

  await db.exec(sql("phase-b"));
  const b = await last(db, sql("verify-b"));
  assert.equal(b.ok, true);
  assert.equal(b.next_migration, "none");
  assert.equal(b.customers_total, 4);
  assert.equal(b.requests_total, 4);
  assert.equal((await db.query("select count(*)::int as n from customers where account_id = 'taiko'")).rows[0].n, 4);
});

await test("バックアップ未取得なら phase-a は何も変更せずに中止", async () => {
  const db = await stateBefore0012();
  await expectAbort(db, sql("phase-a", "0012"), /PHASE_A_NO_BACKUP/);
});

await test("開始番号が実際と違えば phase-a は何も変更せずに中止(推測した番号では適用できない)", async () => {
  const db = await stateBefore0012();
  await db.exec(sql("backup"));
  await expectAbort(db, sql("phase-a", "0013"), /PHASE_A_START_MISMATCH: 実際の次の番号は 0012/);
  await expectAbort(db, sql("phase-a", "0011"), /PHASE_A_START_MISMATCH/);
});

await test("顧客のLINE User IDが重複していれば、事前確認が ready=false、phase-a は中止", async () => {
  const db = await stateBefore0012();
  await db.query("insert into customers (reading_name, line_user_id) values ('重複1', 'Uxx'), ('重複2', 'Uxx')");
  const pre = await last(db, sql("prod-precheck"));
  assert.equal(pre.ready, false);
  assert.match(pre.blockers, /重複/);
  await db.exec(sql("backup"));
  await expectAbort(db, sql("phase-a", "0012"), /PHASE_A_BLOCKED/);
});

await test("phase-a の前に phase-b は実行できない", async () => {
  const db = await stateBefore0012();
  await db.exec(sql("backup"));
  await expectAbort(db, sql("phase-b"), /PHASE_B_NOT_READY/);
});

await test("0004からの本番(申込0件): phase-a で 0004〜0017 をまとめて適用できる(0007は含めない)", async () => {
  const db = await createTestDb({ before: "0004" });
  await db.query("insert into customers (reading_name) values ('既存')");
  const pre = await last(db, sql("prod-precheck"));
  assert.equal(pre.next_migration, "0004");
  assert.equal(pre.ready, true);
  await db.exec(sql("backup"));
  await db.exec(sql("phase-a", "0004"));
  assert.equal((await last(db, sql("verify-a"))).ok, true);
  await db.exec(sql("phase-b"));
  assert.equal((await last(db, sql("verify-b"))).ok, true);
  const diag = await db.query("select count(*)::int as n from information_schema.columns where table_name = 'free_reading_requests' and column_name like 'diagnos%'");
  assert.equal(diag.rows[0].n, 0);
});

await test("0004未適用で申込がある場合は、事前確認が ready=false(0004は列追加できない)", async () => {
  const db = await createTestDb({ before: "0004" });
  await db.query("insert into free_reading_requests (status) values ('new')");
  const pre = await last(db, sql("prod-precheck"));
  assert.equal(pre.ready, false);
  assert.match(pre.blockers, /0004/);
});

await test("0010未適用で、許可されていないステータスの申込があれば ready=false", async () => {
  const db = await createTestDb({ before: "0010" });
  await db.query("insert into free_reading_requests (contact_method, status) values ('line', 'diagnosis_completed')");
  const pre = await last(db, sql("prod-precheck"));
  assert.equal(pre.next_migration, "0010");
  assert.equal(pre.ready, false);
  assert.match(pre.blockers, /ステータス/);
});

await test("バックアップ確認: 取得後に元のデータが変わると ok=false(内容まで比べている)", async () => {
  const db = await stateBefore0012();
  await db.exec(sql("backup"));
  assert.equal((await last(db, sql("backup-check"))).ok, true);
  await db.query("update customers set reading_name = '変更' where reading_name = '既存1'");
  const check = await last(db, sql("backup-check"));
  assert.equal(check.ok, false);
  assert.match(check.mismatched_tables, /customers/);
});

await test("全て適用済みの状態: next_migration = none、ready = true", async () => {
  const db = await createTestDb();
  const pre = await last(db, sql("prod-precheck"));
  assert.equal(pre.next_migration, "none");
  assert.equal(pre.ready, true);
});

await test("どの開始番号からでも、事前確認の next_migration どおりに phase-a → phase-b で最後まで適用できる", async () => {
  for (const before of ["0005", "0006", "0008", "0009", "0011", "0013", "0014", "0015", "0016", "0017"]) {
    const db = await createTestDb({ before });
    await db.query("insert into customers (reading_name) values ('既存')");
    const pre = await last(db, sql("prod-precheck"));
    assert.equal(pre.ready, true, before);
    await db.exec(sql("backup"));
    await db.exec(sql("phase-a", pre.next_migration));
    assert.equal((await last(db, sql("verify-a"))).ok, true, `verify-a (${before})`);
    await db.exec(sql("phase-b"));
    assert.equal((await last(db, sql("verify-b"))).ok, true, `verify-b (${before})`);
  }
});
