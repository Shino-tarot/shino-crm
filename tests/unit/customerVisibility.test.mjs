// 実行: npm test (node --test)。DBには接続しない純粋な関数のテスト。
// src の .ts ファイルを Node.js の型除去機能(Node 22.18以降)でそのまま読み込む。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  VISIBILITY_CONFLICT_MESSAGES,
  canMergeCustomers,
  filterCustomersByView,
  isCustomerHidden,
  searchCustomers,
} from "../../src/lib/customers/visibility.ts";
import { classifyFollowUp } from "../../src/lib/followUp/rules.ts";
import { getLinkBlockReason } from "../../src/lib/lineContacts/rules.ts";

// テスト用のダミーデータ(実在の顧客ではない)
const active = { id: "a", deletedAt: null, lineName: "ライン太郎", readingName: "たろう", realName: "山田" };
const hidden = { id: "h", deletedAt: "2026-10-29T00:00:00.000Z", lineName: "ライン花子", readingName: "はなこ", realName: "佐藤" };
const customers = [active, hidden];

test("非表示の判定", () => {
  assert.equal(isCustomerHidden(active), false);
  assert.equal(isCustomerHidden(hidden), true);
});

test("通常の一覧は表示中の顧客のみ、「非表示の顧客」は非表示のみ", () => {
  assert.deepEqual(filterCustomersByView(customers, "active").map((c) => c.id), ["a"]);
  assert.deepEqual(filterCustomersByView(customers, "hidden").map((c) => c.id), ["h"]);
});

test("非表示→復元(deletedAtをnullに戻す)で通常の一覧に戻る", () => {
  const restored = { ...hidden, deletedAt: null };
  assert.deepEqual(filterCustomersByView([active, restored], "active").map((c) => c.id), ["a", "h"]);
  assert.equal(filterCustomersByView([active, restored], "hidden").length, 0);
});

test("非表示にしても顧客データ自体は失われない(一覧から除外されるだけ)", () => {
  const all = filterCustomersByView(customers, "active").length + filterCustomersByView(customers, "hidden").length;
  assert.equal(all, customers.length);
});

test("検索は表示切り替え後の一覧に対して行う(既存の検索条件を維持)", () => {
  assert.deepEqual(searchCustomers(customers, "  ライン ").map((c) => c.id), ["a", "h"]);
  assert.deepEqual(searchCustomers(customers, "山田").map((c) => c.id), ["a"]);
  assert.deepEqual(searchCustomers(filterCustomersByView(customers, "active"), "はなこ"), []);
  assert.equal(searchCustomers(customers, "").length, 2);
});

test("二重操作時のメッセージ", () => {
  assert.match(VISIBILITY_CONFLICT_MESSAGES.hide, /既に非表示/);
  assert.match(VISIBILITY_CONFLICT_MESSAGES.restore, /既に復元/);
});

test("統合: 非表示の顧客が含まれる場合は統合しない", () => {
  assert.equal(canMergeCustomers([active]), true);
  assert.equal(canMergeCustomers([active, { id: "b", deletedAt: null }]), true);
  assert.equal(canMergeCustomers([active, hidden]), false);
  assert.equal(canMergeCustomers([]), true);
});

// 24時間後フォロー通知
const launchedAt = "2026-10-01T00:00:00.000Z";
const now = new Date("2026-10-29T12:00:00.000Z");
const candidate = {
  status: "free_reading_sent",
  sent_at: "2026-10-27T00:00:00.000Z",
  detail_request: null,
  followed_up_at: null,
};

test("フォロー通知: 表示中の顧客は通常どおり対象", () => {
  assert.equal(classifyFollowUp({ ...candidate, customer_hidden: false }, launchedAt, now), "new");
  assert.equal(classifyFollowUp(candidate, launchedAt, now), "new");
});

test("フォロー通知: 非表示の顧客は対象外", () => {
  assert.equal(classifyFollowUp({ ...candidate, customer_hidden: true }, launchedAt, now), null);
});

test("フォロー通知: 復元後は通常の条件(24時間経過・未回答・未フォロー)で再び対象", () => {
  assert.equal(classifyFollowUp({ ...candidate, customer_hidden: false }, launchedAt, now), "new");
  // 復元しても、通常の除外条件は引き続き効く
  assert.equal(classifyFollowUp({ ...candidate, customer_hidden: false, followed_up_at: "2026-10-28T00:00:00.000Z" }, launchedAt, now), null);
  assert.equal(classifyFollowUp({ ...candidate, customer_hidden: false, sent_at: "2026-10-29T00:00:00.000Z" }, launchedAt, now), null);
});

// LINE紐づけ
const LINE_A = "U" + "a".repeat(32);
const linkBase = {
  contactId: "contact-1",
  contactLineUserId: LINE_A,
  customerId: "customer-1",
  customerLineUserId: "",
  customerHidden: false,
  customerLinkedContactId: null,
  lineUserIdOwnerCustomerIds: [],
};

test("LINE紐づけ: 非表示の顧客には紐づけできない", () => {
  assert.equal(getLinkBlockReason({ ...linkBase, customerHidden: true }), "customer_hidden");
  // LINEユーザーIDが一致していても非表示なら不可
  assert.equal(
    getLinkBlockReason({ ...linkBase, customerHidden: true, customerLineUserId: LINE_A, lineUserIdOwnerCustomerIds: ["customer-1"] }),
    "customer_hidden",
  );
  assert.equal(getLinkBlockReason(linkBase), null);
});
