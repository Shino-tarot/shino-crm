// 実行: npm run test:db
// 0016_accounts_additive.sql が「追加のみ」であることを、メモリ上の空のPostgreSQL(PGlite)で確かめる。
//   - 0015まで適用したDBにダミーデータを入れ、0016の前後で全テーブルの全行・既存のスキーマ
//     (列・制約・トリガー・関数・索引・権限)が変わらないことを比較する
//   - 0016を適用した後も、0015までの機能(統合・削除防止・非表示・Webhook相当の保存)が動くことを確かめる
// 実際のDB(検証用・本番)には一切接続しない。環境変数も読まない。データはすべてダミー。
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";

const MIG = join(import.meta.dirname, "../../supabase/migrations");
const FILE_0016 = "0016_accounts_additive.sql";
const ACCOUNT_TABLES = [
  "customers",
  "free_reading_requests",
  "paid_readings",
  "upsell_purchases",
  "customer_records",
  "line_contacts",
  "conversation_messages",
  "customer_merges",
];

// PGliteにはpgcrypto拡張が無いため、テスト時のみ create extension 行を除く(gen_random_uuidは標準機能)
const readMigration = (file) =>
  readFileSync(join(MIG, file), "utf8").replace(/^\s*create extension[^;]*;/gim, "");

const db = new PGlite();
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
`);
for (const file of readdirSync(MIG).filter((f) => /^\d{4}_.*\.sql$/.test(f) && f < FILE_0016).sort()) {
  await db.exec(readMigration(file));
}

const rows = async (sql, params) => (await db.query(sql, params)).rows;
const one = async (sql, params) => (await rows(sql, params))[0];
const U = (c) => "U" + c.repeat(32);
const asService = async (sql, params) => {
  await db.exec("set role service_role");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
};
async function expectError(promise, pattern) {
  try {
    await promise;
  } catch (e) {
    assert.match(e.message, pattern);
    return;
  }
  throw new Error("エラーにならなかった");
}

// ---------- 0016より前の既存データ(全テーブルに最低1行) ----------
const a = (await one("insert into customers (reading_name, line_user_id) values ('既存A', $1) returning id", [U("a")])).id;
const b = (await one("insert into customers (reading_name) values ('既存B') returning id")).id;
const c = (await one("insert into customers (reading_name) values ('既存C(非表示)') returning id")).id;
await rows("update customers set deleted_at = now() where id = $1", [c]);
const contactA = (await one("insert into line_contacts (line_user_id, customer_id) values ($1, $2) returning id", [U("a"), a])).id;
await rows("insert into line_contacts (line_user_id) values ($1)", [U("b")]);
await rows(
  "insert into conversation_messages (line_contact_id, direction, source, body, sent_at, line_webhook_event_id) values ($1, 'incoming', 'line_webhook', 'ダミー受信', now(), 'ev-0016')",
  [contactA],
);
await rows(
  "insert into conversation_messages (customer_id, direction, source, body, sent_at) values ($1, 'outgoing', 'manual', 'ダミー送信', now())",
  [a],
);
const requestA = (await one("insert into free_reading_requests (customer_id, contact_method, status, sent_at) values ($1, 'line', 'free_reading_sent', now() - interval '2 days') returning id", [a])).id;
await rows("insert into free_reading_requests (contact_method) values ('line')");
await rows("insert into paid_readings (customer_id, amount) values ($1, 6980)", [a]);
await rows("insert into upsell_purchases (customer_id, amount) values ($1, 3000)", [a]);
await rows("insert into customer_records (customer_id, category) values ($1, 'memo')", [a]);
await rows(
  "insert into status_auto_updates (free_reading_request_id, event_type, source_id, from_status, to_status, result) values ($1, 'free_reading_sent', $1, 'new', 'free_reading_sent', 'applied')",
  [requestA],
);
// 統合の記録を1件作る(統合元 b → 統合先 a ではなく、新しい顧客同士で行い既存A/Bはそのまま残す)
const m1 = (await one("insert into customers (reading_name) values ('統合元') returning id")).id;
const m2 = (await one("insert into customers (reading_name) values ('統合先') returning id")).id;
await asService("select public.merge_customers($1, $2, null)", [m1, m2]);

// ---------- 比較用のスナップショット ----------
async function dataSnapshot() {
  const tables = (await rows(
    "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' and table_name <> 'accounts' order by 1",
  )).map((r) => r.table_name);
  const snapshot = {};
  for (const table of tables) {
    const tableRows = await rows(`select * from public.${table}`);
    // 0016で追加される account_id 列だけを除いて比較する
    snapshot[table] = tableRows
      .map(({ account_id, ...rest }) => {
        void account_id;
        return JSON.stringify(rest);
      })
      .sort();
  }
  return snapshot;
}

// 0016で追加されるもの(accounts テーブルと account_id 列・その外部キー)を除いた既存のスキーマ
async function schemaSnapshot() {
  return {
    columns: await rows(`
      select table_name, column_name, data_type, is_nullable, column_default
      from information_schema.columns
      where table_schema = 'public' and table_name <> 'accounts' and column_name <> 'account_id'
      order by 1, 2`),
    constraints: await rows(`
      select conrelid::regclass::text as tbl, conname, pg_get_constraintdef(oid) as def
      from pg_constraint
      where connamespace = 'public'::regnamespace
        and conrelid::regclass::text <> 'accounts' and conname not like '%account_id_fkey'
      order by 1, 2`),
    triggers: await rows(`
      select tgrelid::regclass::text as tbl, tgname, pg_get_triggerdef(oid) as def
      from pg_trigger where not tgisinternal order by 1, 2`),
    functions: await rows(`
      select proname, md5(prosrc) as src, coalesce(proacl::text, '') as acl, prosecdef
      from pg_proc where pronamespace = 'public'::regnamespace order by 1`),
    indexes: await rows(`
      select tablename, indexname, indexdef from pg_indexes
      where schemaname = 'public' and tablename <> 'accounts' order by 1, 2`),
    privileges: await rows(`
      select table_name, grantee, privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and table_name <> 'accounts' order by 1, 2, 3`),
  };
}

const dataBefore = await dataSnapshot();
const schemaBefore = await schemaSnapshot();
await db.exec(readMigration(FILE_0016));

await test("0016: 既存の全テーブル・全行が変わらない(追加された account_id 列以外)", async () => {
  assert.deepEqual(await dataSnapshot(), dataBefore);
});

await test("0016: 既存の列・制約・トリガー・関数・索引・権限が変わらない", async () => {
  assert.deepEqual(await schemaSnapshot(), schemaBefore);
});

await test("0016: 8テーブルに NULL許容・既定値なしの account_id が追加され、既存の行はすべて NULL", async () => {
  const columns = await rows(`
    select table_name, is_nullable, column_default, data_type from information_schema.columns
    where table_schema = 'public' and column_name = 'account_id' order by 1`);
  assert.deepEqual(columns.map((col) => col.table_name), [...ACCOUNT_TABLES].sort());
  for (const col of columns) {
    assert.deepEqual([col.is_nullable, col.column_default, col.data_type], ["YES", null, "text"]);
  }
  for (const table of ACCOUNT_TABLES) {
    const { n } = await one(`select count(*)::int as n from public.${table} where account_id is not null`);
    assert.equal(n, 0, table);
  }
});

await test("0016: accounts に taiko(鯛子)・yayoi(夜宵)の2行のみ", async () => {
  assert.deepEqual(await rows("select id, display_name from accounts order by sort_order"), [
    { id: "taiko", display_name: "鯛子" },
    { id: "yayoi", display_name: "夜宵" },
  ]);
});

await test("0016: 2回実行しても結果が変わらない", async () => {
  const data = await dataSnapshot();
  await db.exec(readMigration(FILE_0016));
  assert.deepEqual(await dataSnapshot(), data);
  assert.equal((await one("select count(*)::int as n from accounts")).n, 2);
  assert.equal((await one("select count(*)::int as n from information_schema.columns where table_schema = 'public' and column_name = 'account_id'")).n, 8);
});

await test("0016: accounts は service_role の読み取りのみ(anon / authenticated は不可、service_role も変更不可)", async () => {
  const p = await one(`select
    has_table_privilege('service_role', 'public.accounts', 'SELECT') as service_select,
    has_table_privilege('service_role', 'public.accounts', 'INSERT') as service_insert,
    has_table_privilege('service_role', 'public.accounts', 'UPDATE') as service_update,
    has_table_privilege('service_role', 'public.accounts', 'DELETE') as service_delete,
    has_table_privilege('anon', 'public.accounts', 'SELECT') as anon_select,
    has_table_privilege('authenticated', 'public.accounts', 'SELECT') as authenticated_select,
    (select relrowsecurity from pg_class where oid = 'public.accounts'::regclass) as rls`);
  assert.deepEqual(p, {
    service_select: true, service_insert: false, service_update: false, service_delete: false,
    anon_select: false, authenticated_select: false, rls: true,
  });
});

await test("0016: 存在しないアカウントは外部キーで拒否、使われているアカウントは削除・識別子変更できない", async () => {
  const id = (await one("insert into customers (reading_name) values ('外部キー確認') returning id")).id;
  await expectError(rows("update customers set account_id = 'nope' where id = $1", [id]), /foreign key/);
  await rows("update customers set account_id = 'yayoi' where id = $1", [id]);
  await expectError(rows("delete from accounts where id = 'yayoi'"), /foreign key/);
  await expectError(rows("update accounts set id = 'yayoi2' where id = 'yayoi'"), /foreign key/);
});

// ---------- 0015までの機能が0016の後も動くこと ----------
await test("0016後: 顧客統合(0015)が動き、アカウント未指定のままでも従来どおり統合できる", async () => {
  const src = (await one("insert into customers (reading_name, line_user_id) values ('統合元2', $1) returning id", [U("c")])).id;
  const tgt = (await one("insert into customers (reading_name) values ('統合先2') returning id")).id;
  await rows("insert into line_contacts (line_user_id, customer_id) values ($1, $2)", [U("c"), src]);
  await rows("insert into free_reading_requests (customer_id, contact_method) values ($1, 'line')", [src]);
  const r = (await asService("select public.merge_customers($1, $2, null) as r", [src, tgt])).rows[0].r;
  assert.equal(r.requests, 1);
  assert.equal(r.line_contact, true);
  assert.equal((await one("select merged_into_customer_id from customers where id = $1", [src])).merged_into_customer_id, tgt);
});

await test("0016後: 顧客の物理削除防止(0014)が維持されている", async () => {
  await expectError(asService("delete from customers where id = $1", [b]), /permission denied/);
  await expectError(rows("delete from customers where id = $1", [b]), /顧客は削除できません/);
  await expectError(rows("truncate customers cascade"), /顧客は削除できません/);
});

await test("0016後: 非表示・復元(0013)が動く", async () => {
  await asService("update customers set deleted_at = now() where id = $1 and deleted_at is null", [b]);
  assert.notEqual((await one("select deleted_at from customers where id = $1", [b])).deleted_at, null);
  await asService("update customers set deleted_at = null, deleted_by = null where id = $1", [b]);
  assert.equal((await one("select deleted_at from customers where id = $1", [b])).deleted_at, null);
});

await test("0016後: 今のアプリと同じ保存(account_id を指定しない)が従来どおりできる", async () => {
  // Webhook相当: LINE送信者の作成と受信メッセージの保存
  const contact = (await asService("insert into line_contacts (line_user_id) values ($1) returning id", [U("d")])).rows[0].id;
  await asService(
    "insert into conversation_messages (line_contact_id, direction, source, body, sent_at, line_webhook_event_id) values ($1, 'incoming', 'line_webhook', 'ダミー', now(), 'ev-after-0016')",
    [contact],
  );
  // 申込・顧客の作成、有料鑑定の登録
  const customer = (await asService("insert into customers (reading_name) values ('新規') returning id")).rows[0].id;
  await asService("insert into free_reading_requests (customer_id, contact_method) values ($1, 'line')", [customer]);
  await asService("insert into paid_readings (customer_id, amount) values ($1, 1000)", [customer]);
  const { n } = await one("select count(*)::int as n from customers where id = $1 and account_id is null", [customer]);
  assert.equal(n, 1);
});

await test("0016後: LINE自動保存の会話履歴の保護(0012)は変わらない(0017で修正予定)", async () => {
  await expectError(
    asService("update conversation_messages set body = '改ざん' where line_webhook_event_id = 'ev-0016'"),
    /LINEから自動保存した会話履歴は変更できません/,
  );
  // account_id の設定も現時点では拒否される(0017でこのトリガーを修正してから振り分ける)
  await expectError(
    asService("update conversation_messages set account_id = 'taiko' where line_webhook_event_id = 'ev-0016'"),
    /LINEから自動保存した会話履歴は変更できません/,
  );
});
