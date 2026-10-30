// 実行: npm run test:db
// 顧客統合の一連の流れ(0019まで適用済みのDB)を、メモリ上のPostgreSQL(PGlite)で確かめる。
//   - 既存顧客(統合と無関係)は1行も変わらない
//   - 新規テスト顧客2件(統合元・統合先)の関連データがすべて統合先へ引き継がれる
//   - 別アカウント間の統合は拒否される
// アプリ(src/lib/customers/linking.ts)と同じ順番で、同じ列の組み合わせを使う。実DBには接続しない。データはダミー。
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, expectError, helpers, lineUserId as U } from "./helpers.mjs";

const db = await createTestDb();
const { rows, one, asService } = helpers(db);
const STAFF = "11111111-1111-1111-1111-111111111111";

// ---------- 既存顧客(統合と無関係。変わらないことを確かめる) ----------
for (const name of ["既存1", "既存2", "既存3"]) {
  const id = (await one("insert into customers (account_id, reading_name) values ('taiko', $1) returning id", [name])).id;
  await rows("insert into free_reading_requests (account_id, customer_id, contact_method, line_name) values ('taiko', $1, 'line', 'よくある名前')", [id]);
}
const snapshotOthers = async (excludeIds) =>
  JSON.stringify(
    await rows(
      `select c.*, (select json_agg(r order by r.id) from free_reading_requests r where r.customer_id = c.id) as requests
       from customers c where not (c.id = any($1::uuid[])) order by c.id`,
      [excludeIds],
    ),
  );

// ---------- 新規テスト顧客2件(ヒアリング手動登録と同じく、申込ごとに顧客を作成) ----------
async function createHearing(accountId, name, lineName, birthDate) {
  const customer = (await asService(
    "insert into customers (account_id, line_name, reading_name, birthday) values ($1, $2, $3, $4) returning id",
    [accountId, lineName, name, birthDate],
  )).rows[0].id;
  const request = (await asService(
    "insert into free_reading_requests (account_id, customer_id, contact_method, reading_name, line_name, birth_date) values ($1, $2, 'line', $3, $4, $5) returning id",
    [accountId, customer, name, lineName, birthDate],
  )).rows[0].id;
  return { customer, request };
}

const source = await createHearing("taiko", "統合元テスト", "【テスト】統合確認2", "1995-04-01");
const target = await createHearing("taiko", "統合先テスト", "【テスト】統合確認2", "1995-04-01");
// 統合元に関連データを一通り付ける(LINE送信者・LINE受信・手動の会話履歴・有料鑑定・アップセル・旧記録)
await asService("update customers set line_user_id = $1 where id = $2", [U("c"), source.customer]);
const contact = (await asService("insert into line_contacts (account_id, line_user_id, customer_id) values ('taiko', $1, $2) returning id", [U("c"), source.customer])).rows[0].id;
await asService("insert into conversation_messages (account_id, line_contact_id, direction, source, body, sent_at, line_webhook_event_id) values ('taiko', $1, 'incoming', 'line_webhook', 'ダミー受信', now(), 'ev-flow')", [contact]);
await asService("insert into conversation_messages (account_id, customer_id, direction, source, body, sent_at) values ('taiko', $1, 'outgoing', 'manual', 'ダミー送信', now())", [source.customer]);
await asService("insert into paid_readings (account_id, customer_id, amount) values ('taiko', $1, 6980)", [source.customer]);
await asService("insert into upsell_purchases (account_id, customer_id, amount) values ('taiko', $1, 3000)", [source.customer]);
await asService("insert into customer_records (account_id, customer_id, category) values ('taiko', $1, 'memo')", [source.customer]);

const othersBefore = await snapshotOthers([source.customer, target.customer]);

await test("統合の実行: 統合元の関連データがすべて統合先へ移り、統合元は非表示＋統合先を記録", async () => {
  const counts = (await asService("select public.merge_customers($1, $2, $3, null) as r", [source.customer, target.customer, STAFF])).rows[0].r;
  assert.deepEqual(counts, { requests: 1, paid_readings: 1, upsell_purchases: 1, customer_records: 1, manual_messages: 1, line_contact: true });

  const owner = async (table) => (await one(`select count(*)::int as n from ${table} where customer_id = $1`, [target.customer])).n;
  assert.equal(await owner("free_reading_requests"), 2);
  assert.equal(await owner("paid_readings"), 1);
  assert.equal(await owner("upsell_purchases"), 1);
  assert.equal(await owner("customer_records"), 1);
  assert.equal(await owner("conversation_messages"), 1);
  assert.equal(await owner("line_contacts"), 1);
  // LINE受信は送信者経由で統合先の会話履歴になる(履歴自体は変更しない)
  assert.equal((await one("select line_contact_id from conversation_messages where line_webhook_event_id = 'ev-flow'")).line_contact_id, contact);

  const src = await one("select deleted_at is not null as hidden, merged_into_customer_id, line_user_id from customers where id = $1", [source.customer]);
  assert.deepEqual(src, { hidden: true, merged_into_customer_id: target.customer, line_user_id: "" });
  const tgt = await one("select deleted_at, line_user_id, reading_name, birthday from customers where id = $1", [target.customer]);
  assert.equal(tgt.deleted_at, null);
  assert.equal(tgt.line_user_id, U("c")); // 空だったので引き継ぐ
  assert.equal(tgt.reading_name, "統合先テスト"); // 基本情報は変更しない

  const log = await one("select account_id, merged_by from customer_merges where source_customer_id = $1", [source.customer]);
  assert.deepEqual(log, { account_id: "taiko", merged_by: STAFF });
});

await test("既存顧客(統合と無関係)は1行も変わらない", async () => {
  assert.equal(await snapshotOthers([source.customer, target.customer]), othersBefore);
});

await test("統合済みの統合元は、再統合・復元・削除のいずれもできない", async () => {
  const other = await createHearing("taiko", "別テスト", "別", null);
  await expectError(asService("select public.merge_customers($1, $2, null, null)", [source.customer, other.customer]), /MERGE_CUSTOMER_HIDDEN/);
  await expectError(asService("update customers set deleted_at = null where id = $1", [source.customer]), /customers_merged_must_be_hidden_check/);
  await expectError(asService("delete from customers where id = $1", [source.customer]), /permission denied/);
});

await test("別アカウント間の統合は拒否され、どちらも変わらない", async () => {
  const taiko = await createHearing("taiko", "同姓同名テスト", "【テスト】統合確認2", "2000-01-01");
  const yayoi = await createHearing("yayoi", "同姓同名テスト", "【テスト】統合確認2", "2000-01-01");
  const before = await rows("select * from customers where id in ($1, $2) order by id", [taiko.customer, yayoi.customer]);
  await expectError(asService("select public.merge_customers($1, $2, null, null)", [yayoi.customer, taiko.customer]), /MERGE_CROSS_ACCOUNT/);
  await expectError(asService("select public.merge_customers($1, $2, null, null)", [taiko.customer, yayoi.customer]), /MERGE_CROSS_ACCOUNT/);
  assert.deepEqual(await rows("select * from customers where id in ($1, $2) order by id", [taiko.customer, yayoi.customer]), before);
  // 画面の候補(同じLINE表示名の申込)も同じアカウント内だけ: 鯛子から検索すると夜宵の申込は出ない
  const candidates = await rows("select account_id from free_reading_requests where account_id = 'taiko' and line_name = '【テスト】統合確認2'");
  assert.ok(candidates.every((r) => r.account_id === "taiko"));
});

await test("生年月日が違うテスト顧客は、理由なしでは統合されない(理由ありなら統合し記録)", async () => {
  const a = await createHearing("taiko", "生年月日テストA", "【テスト】生年月日", "1990-01-01");
  const b = await createHearing("taiko", "生年月日テストB", "【テスト】生年月日", "1991-01-01");
  await expectError(asService("select public.merge_customers($1, $2, null, null)", [a.customer, b.customer]), /MERGE_BIRTHDAY_MISMATCH/);
  assert.equal((await one("select deleted_at from customers where id = $1", [a.customer])).deleted_at, null);
  await asService("select public.merge_customers($1, $2, null, '本人に確認済み')", [a.customer, b.customer]);
  assert.equal((await one("select reason from customer_merges where source_customer_id = $1", [a.customer])).reason, "本人に確認済み");
});
