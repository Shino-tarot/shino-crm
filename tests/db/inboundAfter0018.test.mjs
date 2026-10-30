// 実行: npm run test:db
// 0018適用後に、LINE Webhook(src/lib/line/webhookStore.ts)と公開の申込フォーム
// (src/lib/freeReadingRequests/publicActions.ts / createCustomer.ts)が送るのと同じ列の組み合わせで
// 保存できることを、メモリ上のPostgreSQL(PGlite)で確かめる。実DBには接続しない。データはダミー。
import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, expectError, helpers, lineUserId as U } from "./helpers.mjs";

const db = await createTestDb();
const { one, asService } = helpers(db);
// アプリの INBOUND_ACCOUNT_ID(src/lib/accounts/accounts.ts)と同じ
const INBOUND = "taiko";

await test("Webhook: 新しい送信者の作成・受信メッセージの保存・最終受信日時の更新・友だち状態の更新", async () => {
  // ensureContact: findContact(account_id + line_user_id) → 無ければ insert
  const contact = (await asService(
    "insert into line_contacts (account_id, line_user_id, last_message_at) values ($1, $2, now()) returning id",
    [INBOUND, U("a")],
  )).rows[0].id;
  // insertIncomingMessage
  await asService(
    `insert into conversation_messages (account_id, line_contact_id, direction, source, message_type, body, sent_at, line_webhook_event_id, line_message_id)
     values ($1, $2, 'incoming', 'line_webhook', 'text', 'ダミー受信', now(), 'ev-inbound-1', 'm1')`,
    [INBOUND, contact],
  );
  // 再送(同じイベントID)は重複として拒否され、二重保存されない
  await expectError(
    asService(
      `insert into conversation_messages (account_id, line_contact_id, direction, source, message_type, body, sent_at, line_webhook_event_id)
       values ($1, $2, 'incoming', 'line_webhook', 'text', 'ダミー受信', now(), 'ev-inbound-1')`,
      [INBOUND, contact],
    ),
    /duplicate key/,
  );
  // 同時に届いた2通目で送信者の作成が競合した場合はUNIQUE違反(23505)になり、アプリは既存の行を使う
  await expectError(
    asService("insert into line_contacts (account_id, line_user_id) values ($1, $2)", [INBOUND, U("a")]),
    /duplicate key/,
  );
  await asService("update line_contacts set last_message_at = now() where id = $1 and account_id = $2", [contact, INBOUND]);
  await asService("update line_contacts set display_name = 'ダミー', picture_url = null where id = $1 and account_id = $2", [contact, INBOUND]);
  await asService("update line_contacts set friend_status = 'blocked' where account_id = $1 and line_user_id = $2", [INBOUND, U("a")]);
  const row = await one("select account_id, friend_status from line_contacts where id = $1", [contact]);
  assert.deepEqual(row, { account_id: "taiko", friend_status: "blocked" });
});

await test("Webhook: account_id を付けない旧版の保存は拒否される(混在防止)", async () => {
  await expectError(asService("insert into line_contacts (line_user_id) values ($1)", [U("b")]), /account_id/);
});

await test("公開の申込フォーム: 顧客の自動作成と申込の保存(どちらも鯛子)", async () => {
  const customer = (await asService(
    "insert into customers (account_id, line_name, reading_name, birthday, gender, age) values ($1, 'ダミーLINE', 'ダミー', '1990-01-01', '', null) returning id",
    [INBOUND],
  )).rows[0].id;
  await asService(
    "insert into free_reading_requests (account_id, customer_id, contact_method, reading_name, line_name) values ($1, $2, 'line', 'ダミー', 'ダミーLINE')",
    [INBOUND, customer],
  );
  // 顧客の自動作成に失敗した場合(customer_id = null)も申込だけは保存できる(従来どおり)
  await asService("insert into free_reading_requests (account_id, customer_id, contact_method) values ($1, null, 'line')", [INBOUND]);
});

await test("公開の申込フォーム: 鯛子の顧客に夜宵の申込は付けられない", async () => {
  const customer = (await asService("insert into customers (account_id, reading_name) values ('taiko', 'ダミー') returning id")).rows[0].id;
  await expectError(
    asService("insert into free_reading_requests (account_id, customer_id, contact_method) values ('yayoi', $1, 'line')", [customer]),
    /foreign key/,
  );
});

// ---------- 0019: 公開用キー(anon)による直接INSERTの停止 ----------
await test("0019: anon は申込を直接INSERTできない(service_role の保存は従来どおり)", async () => {
  const p = await one(`select
    has_table_privilege('anon', 'public.free_reading_requests', 'INSERT') as anon_can_insert,
    has_table_privilege('service_role', 'public.free_reading_requests', 'INSERT') as service_can_insert,
    (select count(*)::int from pg_policies
     where tablename = 'free_reading_requests' and policyname = 'anon can insert free reading requests') as anon_policy`);
  assert.deepEqual(p, { anon_can_insert: false, service_can_insert: true, anon_policy: 0 });
  await db.exec("set role anon");
  try {
    await expectError(
      db.query("insert into free_reading_requests (account_id, contact_method) values ('yayoi', 'line')"),
      /permission denied/,
    );
  } finally {
    await db.exec("reset role");
  }
  await asService("insert into free_reading_requests (account_id, contact_method) values ('taiko', 'line')");
});
