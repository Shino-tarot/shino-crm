// 実行: npm run test:db
// supabase/migrations の0001〜0015を「メモリ上の空のPostgreSQL(PGlite)」に順番に適用し、
// 顧客統合関数 merge_customers(0015)・削除防止(0014)の動作を確かめる。
// 実際のDB(検証用・本番)には一切接続しない。環境変数も読まない。データはすべてダミー。
// 注意: Supabase固有の機能(自動の権限付与・pgcrypto拡張など)は再現しないため、
//       実DBへの適用後は各マイグレーションに書かれた確認SQLでも必ず確認すること。
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";

const MIG = join(import.meta.dirname, "../../supabase/migrations");
const db = new PGlite();

// Supabaseに存在するロールを用意する
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
`);
// このファイルは0015時点の統合関数を確かめる(0016以降のアカウント分離後の動作は accountIsolation.test.mjs)
for (const file of readdirSync(MIG).filter((f) => /^\d{4}_.*\.sql$/.test(f) && f < "0016").sort()) {
  try {
    // PGliteにはpgcrypto拡張が無いため、テスト時のみ create extension 行を除く(gen_random_uuidは標準機能)
    const sql = readFileSync(`${MIG}/${file}`, "utf8").replace(/^\s*create extension[^;]*;/gim, "");
    await db.exec(sql);
  } catch (e) {
    console.log(`適用エラー ${file}: ${e.message}`);
    throw e;
  }
}

const U = (c) => "U" + c.repeat(32);
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const asService = async (sql, params) => {
  await db.exec("set role service_role");
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
};
const merge = (src, tgt) =>
  asService("select public.merge_customers($1, $2, $3) as r", [src, tgt, "11111111-1111-1111-1111-111111111111"]);
async function expectError(promise, pattern) {
  try {
    await promise;
  } catch (e) {
    assert.match(e.message, pattern);
    return;
  }
  throw new Error("エラーにならなかった");
}
async function customer(lineUserId = "") {
  return (await one("insert into customers (reading_name, line_user_id) values ('ダミー', $1) returning id", [lineUserId])).id;
}
async function contact(lineUserId, customerId) {
  return (await one("insert into line_contacts (line_user_id, customer_id) values ($1, $2) returning id", [lineUserId, customerId])).id;
}
async function snapshot(customerId) {
  return one(
    `select
      (select count(*)::int from free_reading_requests where customer_id = $1) as requests,
      (select count(*)::int from paid_readings where customer_id = $1) as paid,
      (select count(*)::int from upsell_purchases where customer_id = $1) as upsell,
      (select count(*)::int from customer_records where customer_id = $1) as records,
      (select count(*)::int from conversation_messages where customer_id = $1) as manual,
      (select count(*)::int from line_contacts where customer_id = $1) as contacts,
      (select line_user_id from customers where id = $1) as line_user_id,
      (select deleted_at is not null from customers where id = $1) as hidden,
      (select merged_into_customer_id from customers where id = $1) as merged_into`,
    [customerId],
  );
}
async function seedFull(customerId) {
  await db.query("insert into free_reading_requests (customer_id, contact_method) values ($1, 'line'), ($1, 'line')", [customerId]);
  await db.query("insert into paid_readings (customer_id, amount) values ($1, 6980)", [customerId]);
  await db.query("insert into paid_readings (customer_id, amount, deleted_at) values ($1, 1000, now())", [customerId]);
  await db.query("insert into upsell_purchases (customer_id, amount) values ($1, 3000)", [customerId]);
  await db.query("insert into customer_records (customer_id, category) values ($1, 'memo')", [customerId]);
  await db.query(
    "insert into conversation_messages (customer_id, direction, source, body, sent_at) values ($1, 'outgoing', 'manual', 'ダミー', now())",
    [customerId],
  );
}

await test("基本: 全データ・LINE紐づけが統合先へ移り、統合元は非表示＋統合先を記録", async () => {
  const src = await customer(U("a"));
  const tgt = await customer("");
  const cid = await contact(U("a"), src);
  await db.query(
    "insert into conversation_messages (line_contact_id, direction, source, body, sent_at, line_webhook_event_id) values ($1, 'incoming', 'line_webhook', 'ダミー', now(), 'ev-1')",
    [cid],
  );
  await seedFull(src);
  const r = (await merge(src, tgt)).rows[0].r;
  assert.deepEqual(r, { requests: 2, paid_readings: 2, upsell_purchases: 1, customer_records: 1, manual_messages: 1, line_contact: true });
  const s = await snapshot(src);
  const g = await snapshot(tgt);
  assert.deepEqual([s.requests, s.paid, s.upsell, s.records, s.manual, s.contacts], [0, 0, 0, 0, 0, 0]);
  assert.deepEqual([g.requests, g.paid, g.upsell, g.records, g.manual, g.contacts], [2, 2, 1, 1, 1, 1]);
  assert.equal(s.hidden, true);
  assert.equal(s.merged_into, tgt);
  assert.equal(s.line_user_id, "");
  assert.equal(g.line_user_id, U("a"));
  assert.equal(g.hidden, false);
  // LINE自動保存の履歴は変更されず、LINE送信者経由で統合先に表示される
  const m = await one("select line_contact_id, customer_id from conversation_messages where line_webhook_event_id = 'ev-1'");
  assert.equal(m.line_contact_id, cid);
  assert.equal(m.customer_id, null);
  const log = await one("select source_line_user_id, target_line_user_id_filled, moved_line_contact_id from customer_merges where source_customer_id = $1", [src]);
  assert.deepEqual([log.source_line_user_id, log.target_line_user_id_filled, log.moved_line_contact_id], [U("a"), true, cid]);
});

await test("統合先にLINE送信者がいて統合元にLINEが無い場合: 統合先の紐づけを維持", async () => {
  const src = await customer("");
  const tgt = await customer(U("b"));
  await contact(U("b"), tgt);
  await seedFull(src);
  await merge(src, tgt);
  const g = await snapshot(tgt);
  assert.equal(g.contacts, 1);
  assert.equal(g.line_user_id, U("b"));
});

await test("統合先に既にLINE User IDがある場合は上書きしない(別顧客のIDを持つ送信者は統合元に紐づけられないことも確認)", async () => {
  const src = await customer("");
  const tgt = await customer(U("c"));
  // 0012のトリガーにより、統合先のIDを持つLINE送信者は統合元に紐づけられない
  await expectError(contact(U("c"), src), /別の顧客に登録されている/);
  const g0 = await snapshot(tgt);
  await merge(src, tgt);
  assert.equal((await snapshot(tgt)).line_user_id, g0.line_user_id);
});

await test("競合: 両方に別のLINE送信者 → エラー、何も変わらない", async () => {
  const src = await customer(U("d"));
  const tgt = await customer(U("e"));
  await contact(U("d"), src);
  await contact(U("e"), tgt);
  await seedFull(src);
  const before = [await snapshot(src), await snapshot(tgt)];
  await expectError(merge(src, tgt), /MERGE_LINE_BOTH_LINKED/);
  assert.deepEqual([await snapshot(src), await snapshot(tgt)], before);
});

await test("競合: LINE User IDの食い違い → エラー、何も変わらない", async () => {
  const src = await customer(U("f"));
  const tgt = await customer(U("0"));
  await seedFull(src);
  const before = [await snapshot(src), await snapshot(tgt)];
  await expectError(merge(src, tgt), /MERGE_LINE_USER_ID_CONFLICT/);
  assert.deepEqual([await snapshot(src), await snapshot(tgt)], before);
});

await test("統合先にLINE User IDがあり、統合元の送信者のIDと違う → エラー", async () => {
  const src = await customer("");
  const tgt = await customer(U("1"));
  await contact(U("2"), src);
  await expectError(merge(src, tgt), /MERGE_LINE_USER_ID_CONFLICT/);
});

await test("非表示の顧客・同じ顧客・存在しない顧客 → エラー", async () => {
  const src = await customer("");
  const tgt = await customer("");
  await db.query("update customers set deleted_at = now() where id = $1", [src]);
  await expectError(merge(src, tgt), /MERGE_CUSTOMER_HIDDEN/);
  await expectError(merge(tgt, tgt), /MERGE_SAME_CUSTOMER/);
  await expectError(merge("00000000-0000-0000-0000-000000000000", tgt), /MERGE_CUSTOMER_NOT_FOUND/);
});

await test("統合済みの顧客は再統合・復元できない", async () => {
  const src = await customer("");
  const tgt = await customer("");
  const other = await customer("");
  await merge(src, tgt);
  await expectError(merge(src, other), /MERGE_CUSTOMER_HIDDEN/);
  // 復元(deleted_atをNULLに戻す)はCHECK制約で拒否される
  await expectError(asService("update customers set deleted_at = null where id = $1", [src]), /customers_merged_must_be_hidden_check/);
});

await test("途中で失敗した場合はすべて元に戻る(トランザクション)", async () => {
  const src = await customer(U("3"));
  const tgt = await customer("");
  await contact(U("3"), src);
  await seedFull(src);
  const before = [await snapshot(src), await snapshot(tgt)];
  // 後半の付け替え(customer_records)で必ず失敗するテスト用トリガーを一時的に追加する
  await db.exec(`
    create function test_fail() returns trigger language plpgsql as $$ begin raise exception 'TEST_FAIL'; end; $$;
    create trigger test_fail before update on customer_records for each row execute function test_fail();
  `);
  await expectError(merge(src, tgt), /TEST_FAIL/);
  await db.exec("drop trigger test_fail on customer_records; drop function test_fail();");
  assert.deepEqual([await snapshot(src), await snapshot(tgt)], before);
  assert.equal((await one("select count(*)::int as n from customer_merges where source_customer_id = $1", [src])).n, 0);
});

await test("権限: anon / authenticated は統合関数を実行できない", async () => {
  const src = await customer("");
  const tgt = await customer("");
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    try {
      await expectError(db.query("select public.merge_customers($1, $2, null)", [src, tgt]), /permission denied/);
    } finally {
      await db.exec("reset role");
    }
  }
  assert.equal((await snapshot(src)).hidden, false);
});

await test("0014維持: service_role は顧客を削除できず、所有者もトリガーで拒否", async () => {
  const id = await customer("");
  await expectError(asService("delete from customers where id = $1", [id]), /permission denied/);
  await expectError(db.query("delete from customers where id = $1", [id]), /顧客は削除できません/);
  await expectError(db.query("truncate customers cascade"), /顧客は削除できません/);
});

await test("非表示・復元(未統合の顧客)は引き続き使える", async () => {
  const id = await customer("");
  await asService("update customers set deleted_at = now(), deleted_by = null where id = $1 and deleted_at is null", [id]);
  assert.equal((await snapshot(id)).hidden, true);
  await asService("update customers set deleted_at = null, deleted_by = null where id = $1", [id]);
  assert.equal((await snapshot(id)).hidden, false);
});


await test("0013〜0015は2回実行しても結果が変わらない(再実行してもエラーにならない)", async () => {
  const before = await one("select count(*)::int as customers, (select count(*)::int from customer_merges) as merges from customers");
  for (const file of ["0013_customers_soft_delete.sql", "0014_prevent_customer_physical_delete.sql", "0015_customer_merge_function.sql"]) {
    await db.exec(readFileSync(join(MIG, file), "utf8"));
  }
  assert.deepEqual(await one("select count(*)::int as customers, (select count(*)::int from customer_merges) as merges from customers"), before);
  // 再実行後も service_role 以外は統合関数を実行できない
  const privileges = await one(`select
    has_function_privilege('service_role', 'public.merge_customers(uuid, uuid, uuid)', 'EXECUTE') as service_role,
    has_function_privilege('anon', 'public.merge_customers(uuid, uuid, uuid)', 'EXECUTE') as anon,
    has_function_privilege('authenticated', 'public.merge_customers(uuid, uuid, uuid)', 'EXECUTE') as authenticated`);
  assert.deepEqual(privileges, { service_role: true, anon: false, authenticated: false });
});
