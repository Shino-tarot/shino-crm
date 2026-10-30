// 実行: npm run test:db
// 0017(既存データを鯛子へ振り分け)・0018(アカウント分離の強制)を、メモリ上の空のPostgreSQL(PGlite)で確かめる。
// 実際のDB(検証用・本番)には一切接続しない。データはすべてダミー。
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, expectError, helpers, lineUserId as U, readMigration } from "./helpers.mjs";

const db = await createTestDb({ before: "0017" });
const { rows, one, asService } = helpers(db);
const TABLES = [
  "customers", "free_reading_requests", "paid_readings", "upsell_purchases",
  "customer_records", "line_contacts", "conversation_messages", "customer_merges",
];

// ---------- 0017より前の既存データ(account_id は NULL) ----------
const a = (await one("insert into customers (reading_name, line_user_id, birthday) values ('既存A', $1, '1990-01-01') returning id", [U("a")])).id;
const b = (await one("insert into customers (reading_name) values ('既存B') returning id")).id;
const contactA = (await one("insert into line_contacts (line_user_id, customer_id) values ($1, $2) returning id", [U("a"), a])).id;
await rows(
  "insert into conversation_messages (line_contact_id, direction, source, body, sent_at, line_webhook_event_id) values ($1, 'incoming', 'line_webhook', 'ダミー受信', now(), 'ev-0017')",
  [contactA],
);
await rows("insert into conversation_messages (customer_id, direction, source, body, sent_at) values ($1, 'outgoing', 'manual', 'ダミー送信', now())", [a]);
await rows("insert into free_reading_requests (customer_id, contact_method) values ($1, 'line'), (null, 'line')", [a]);
await rows("insert into paid_readings (customer_id, amount) values ($1, 6980)", [a]);
await rows("insert into upsell_purchases (customer_id, amount) values ($1, 3000)", [a]);
await rows("insert into customer_records (customer_id, category) values ($1, 'memo')", [a]);
const m1 = (await one("insert into customers (reading_name) values ('統合元') returning id")).id;
const m2 = (await one("insert into customers (reading_name) values ('統合先') returning id")).id;
await asService("select public.merge_customers($1, $2, null)", [m1, m2]);
// 古い日時の updated_at にしておき、振り分けで変わらないことを確かめる
for (const table of ["customers", "free_reading_requests", "paid_readings", "upsell_purchases", "customer_records", "line_contacts"]) {
  await rows(`update public.${table} set updated_at = '2026-01-01T00:00:00Z'`);
}

async function snapshot() {
  const result = {};
  for (const table of TABLES) {
    result[table] = (await rows(`select * from public.${table}`))
      // 0016〜0018で追加される列(account_id・customer_merges.reason)だけを除いて比べる
      .map(({ account_id, reason, ...rest }) => {
        void account_id;
        void reason;
        return JSON.stringify(rest);
      })
      .sort();
  }
  return result;
}

const before0017 = await snapshot();
await db.exec(readMigration("0017_assign_existing_data_to_taiko.sql"));

await test("0017: すべての既存行が taiko に振り分けられる", async () => {
  for (const table of TABLES) {
    const r = await one(`select count(*)::int as total, count(*) filter (where account_id = 'taiko')::int as taiko from public.${table}`);
    assert.ok(r.total > 0, `${table} にテストデータがある`);
    assert.equal(r.taiko, r.total, table);
  }
});

await test("0017: account_id 以外の列(updated_at を含む)は1つも変わらない", async () => {
  assert.deepEqual(await snapshot(), before0017);
});

await test("0017: updated_at の自動更新トリガーが有効に戻っている", async () => {
  const triggers = await rows("select tgname, tgenabled from pg_trigger where tgname like '%_set_updated_at' order by 1");
  assert.equal(triggers.length, 7);
  assert.ok(triggers.every((t) => t.tgenabled === "O"));
});

await test("0017: LINE自動保存の会話履歴の保護は維持(本文の変更・削除・アカウントの書き換えは拒否)", async () => {
  await expectError(rows("update conversation_messages set body = '改ざん' where line_webhook_event_id = 'ev-0017'"), /変更できません/);
  await expectError(rows("delete from conversation_messages where line_webhook_event_id = 'ev-0017'"), /削除できません/);
  await expectError(rows("update conversation_messages set account_id = 'yayoi' where line_webhook_event_id = 'ev-0017'"), /変更できません/);
});

await test("0017: 2回実行しても結果が変わらない", async () => {
  const s = await snapshot();
  await db.exec(readMigration("0017_assign_existing_data_to_taiko.sql"));
  assert.deepEqual(await snapshot(), s);
});

// ---------- 0018 ----------
const before0018 = await snapshot();
await db.exec(readMigration("0018_enforce_account_isolation.sql"));

await test("0018: 既存データは1行も変わらない", async () => {
  assert.deepEqual(await snapshot(), before0018);
});

await test("0018: 2回実行しても結果が変わらない", async () => {
  await db.exec(readMigration("0018_enforce_account_isolation.sql"));
  assert.deepEqual(await snapshot(), before0018);
});

await test("0018: account_id が空欄の保存は拒否される", async () => {
  await expectError(asService("insert into customers (reading_name) values ('アカウントなし')"), /account_id/);
  await expectError(asService("insert into line_contacts (line_user_id) values ($1)", [U("f")]), /account_id/);
});

await test("0018: アカウントをまたぐ紐づけは拒否される", async () => {
  // 鯛子の顧客Aに、夜宵の有料鑑定・申込・記録・LINE送信者・会話履歴は付けられない
  await expectError(asService("insert into paid_readings (account_id, customer_id, amount) values ('yayoi', $1, 1)", [a]), /foreign key/);
  await expectError(asService("insert into upsell_purchases (account_id, customer_id, amount) values ('yayoi', $1, 1)", [a]), /foreign key/);
  await expectError(asService("insert into customer_records (account_id, customer_id, category) values ('yayoi', $1, 'memo')", [a]), /foreign key/);
  await expectError(asService("insert into free_reading_requests (account_id, customer_id, contact_method) values ('yayoi', $1, 'line')", [a]), /foreign key/);
  await expectError(asService("insert into conversation_messages (account_id, customer_id, direction, source, body, sent_at) values ('yayoi', $1, 'outgoing', 'manual', 'x', now())", [a]), /foreign key/);
  const yayoiContact = (await asService("insert into line_contacts (account_id, line_user_id) values ('yayoi', $1) returning id", [U("e")])).rows[0].id;
  await expectError(asService("update line_contacts set customer_id = $1 where id = $2", [b, yayoiContact]), /foreign key/);
  await expectError(
    asService("insert into conversation_messages (account_id, line_contact_id, direction, source, body, sent_at, line_webhook_event_id) values ('taiko', $1, 'incoming', 'line_webhook', 'x', now(), 'ev-cross')", [yayoiContact]),
    /foreign key/,
  );
  // 同じアカウントなら保存できる
  await asService("insert into paid_readings (account_id, customer_id, amount) values ('taiko', $1, 1)", [a]);
});

await test("0018: 一度決まったアカウントは変更できない", async () => {
  await expectError(asService("update customers set account_id = 'yayoi' where id = $1", [b]), /ACCOUNT_ID_IMMUTABLE/);
  await expectError(rows("update free_reading_requests set account_id = 'yayoi'"), /ACCOUNT_ID_IMMUTABLE/);
});

await test("0018: LINE User IDの重複禁止はアカウントごと(鯛子と夜宵で同じIDは別の送信者・顧客として扱う)", async () => {
  // 鯛子に U(a) の送信者と顧客がいても、夜宵で同じIDの送信者・顧客を作り、紐づけられる
  const yCustomer = (await asService("insert into customers (account_id, reading_name, line_user_id) values ('yayoi', '夜宵の別人', $1) returning id", [U("a")])).rows[0].id;
  const yContact = (await asService("insert into line_contacts (account_id, line_user_id) values ('yayoi', $1) returning id", [U("a")])).rows[0].id;
  await asService("update line_contacts set customer_id = $1 where id = $2", [yCustomer, yContact]);
  // 同じアカウント内の重複は従来どおり拒否
  await expectError(asService("insert into line_contacts (account_id, line_user_id) values ('taiko', $1)", [U("a")]), /duplicate key/);
  await expectError(asService("insert into customers (account_id, reading_name, line_user_id) values ('taiko', '重複', $1)", [U("a")]), /duplicate key|紐づいている/);
});

await test("0018: 統合はアカウントをまたげない", async () => {
  const t = (await asService("insert into customers (account_id, reading_name) values ('taiko', '鯛子の山田') returning id")).rows[0].id;
  const y = (await asService("insert into customers (account_id, reading_name) values ('yayoi', '夜宵の山田') returning id")).rows[0].id;
  await expectError(asService("select public.merge_customers($1, $2, null, null)", [y, t]), /MERGE_CROSS_ACCOUNT/);
  assert.equal((await one("select deleted_at from customers where id = $1", [y])).deleted_at, null);
});

await test("0018: 生年月日が違う統合は理由が無ければ拒否、理由があれば統合して記録する", async () => {
  const src = (await asService("insert into customers (account_id, reading_name, birthday) values ('taiko', '生年月日A', '1990-01-01') returning id")).rows[0].id;
  const tgt = (await asService("insert into customers (account_id, reading_name) values ('taiko', '生年月日B') returning id")).rows[0].id;
  // 統合先は顧客の birthday が空で、最新の申込の生年月日が違う
  await asService("insert into free_reading_requests (account_id, customer_id, contact_method, birth_date) values ('taiko', $1, 'line', '1991-02-02')", [tgt]);
  await expectError(asService("select public.merge_customers($1, $2, null, null)", [src, tgt]), /MERGE_BIRTHDAY_MISMATCH/);
  await expectError(asService("select public.merge_customers($1, $2, null, '   ')", [src, tgt]), /MERGE_BIRTHDAY_MISMATCH/);
  await asService("select public.merge_customers($1, $2, null, '本人に確認済み(生年月日の入力ミス)')", [src, tgt]);
  const log = await one("select account_id, reason from customer_merges where source_customer_id = $1", [src]);
  assert.deepEqual(log, { account_id: "taiko", reason: "本人に確認済み(生年月日の入力ミス)" });
});

await test("0018: 同じアカウント内の通常の統合は動く(3引数の呼び出しも理由なしとして動く)", async () => {
  const src = (await asService("insert into customers (account_id, reading_name, birthday) values ('yayoi', '統合元Y', '2000-05-05') returning id")).rows[0].id;
  const tgt = (await asService("insert into customers (account_id, reading_name, birthday) values ('yayoi', '統合先Y', '2000-05-05') returning id")).rows[0].id;
  await asService("insert into free_reading_requests (account_id, customer_id, contact_method) values ('yayoi', $1, 'line')", [src]);
  const r = (await asService("select public.merge_customers($1, $2, null) as r", [src, tgt])).rows[0].r;
  assert.equal(r.requests, 1);
  assert.equal((await one("select account_id from customer_merges where source_customer_id = $1", [src])).account_id, "yayoi");
});

await test("0018: 権限(統合関数は service_role のみ、旧3引数の関数は削除)", async () => {
  const p = await one(`select
    has_function_privilege('service_role', 'public.merge_customers(uuid, uuid, uuid, text)', 'EXECUTE') as service_role,
    has_function_privilege('anon', 'public.merge_customers(uuid, uuid, uuid, text)', 'EXECUTE') as anon,
    has_function_privilege('authenticated', 'public.merge_customers(uuid, uuid, uuid, text)', 'EXECUTE') as authenticated,
    has_function_privilege('public', 'public.merge_customers(uuid, uuid, uuid, text)', 'EXECUTE') as public_role,
    has_function_privilege('anon', 'public.customer_effective_birthday(uuid)', 'EXECUTE') as birthday_anon,
    (select count(*)::int from pg_proc where proname = 'merge_customers') as merge_functions`);
  assert.deepEqual(p, { service_role: true, anon: false, authenticated: false, public_role: false, birthday_anon: false, merge_functions: 1 });
});

await test("0018: 0014の削除防止・0013の非表示と復元・0015の統合済み顧客の復元禁止は維持", async () => {
  await expectError(asService("delete from customers where id = $1", [b]), /permission denied/);
  await expectError(rows("delete from customers where id = $1", [b]), /顧客は削除できません/);
  await asService("update customers set deleted_at = now() where id = $1", [b]);
  await asService("update customers set deleted_at = null where id = $1", [b]);
  await expectError(asService("update customers set deleted_at = null where id = $1", [m1]), /customers_merged_must_be_hidden_check/);
});

await test("0018: ファイル先頭の「実行後の確認SQL」が想定どおりの値を返す", async () => {
  const p = await one(`select
    (select count(*)::int from information_schema.columns
     where table_schema = 'public' and column_name = 'account_id' and is_nullable = 'NO') as required_account_columns,
    (select count(*)::int from pg_constraint where contype = 'f' and conname in (
       'free_reading_requests_account_customer_fkey', 'paid_readings_account_customer_fkey',
       'upsell_purchases_account_customer_fkey', 'customer_records_account_customer_fkey',
       'line_contacts_account_customer_fkey', 'conversation_messages_account_customer_fkey',
       'conversation_messages_account_line_contact_fkey', 'customer_merges_account_source_fkey',
       'customer_merges_account_target_fkey', 'customers_account_merged_into_fkey')) as account_fkeys,
    (select count(*)::int from pg_trigger where tgname like '%_prevent_account_change') as account_change_guards,
    (to_regprocedure('public.merge_customers(uuid, uuid, uuid)') is null) as old_merge_removed,
    has_table_privilege('service_role', 'public.customers', 'DELETE') as service_role_can_delete`);
  assert.deepEqual(p, { required_account_columns: 8, account_fkeys: 10, account_change_guards: 8, old_merge_removed: true, service_role_can_delete: false });
});
