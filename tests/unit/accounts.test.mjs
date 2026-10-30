// 実行: npm test (node --test)。DBには接続しない純粋な関数のテスト。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACCOUNTS,
  DEFAULT_ACCOUNT_ID,
  INBOUND_ACCOUNT_ID,
  accountLabel,
  isAccountId,
  isSameAccount,
  resolveAccountId,
} from "../../src/lib/accounts/accounts.ts";

test("アカウントは taiko(鯛子)・yayoi(夜宵) の2つ(DBの accounts と同じ)", () => {
  assert.deepEqual(ACCOUNTS.map((a) => [a.id, a.label]), [["taiko", "鯛子"], ["yayoi", "夜宵"]]);
  assert.equal(accountLabel("yayoi"), "夜宵");
});

test("cookieの値の解釈: 不正・未設定は既定(鯛子)", () => {
  assert.equal(resolveAccountId("yayoi"), "yayoi");
  assert.equal(resolveAccountId("taiko"), "taiko");
  assert.equal(resolveAccountId(undefined), DEFAULT_ACCOUNT_ID);
  assert.equal(resolveAccountId("YAYOI"), "taiko");
  assert.equal(resolveAccountId("shino"), "taiko");
  assert.equal(resolveAccountId(""), "taiko");
});

test("画面のアカウントと選択中のアカウントが違えば拒否する(別タブで切り替えた後の古い画面)", () => {
  assert.equal(isSameAccount("taiko", "taiko"), true);
  assert.equal(isSameAccount("taiko", "yayoi"), false);
  assert.equal(isSameAccount(undefined, "taiko"), false);
  assert.equal(isSameAccount("nope", "taiko"), false);
  assert.equal(isSameAccount(null, "yayoi"), false);
});

test("LINE Webhook・公開フォームの保存先は当面鯛子", () => {
  assert.equal(INBOUND_ACCOUNT_ID, "taiko");
  assert.equal(isAccountId(INBOUND_ACCOUNT_ID), true);
  assert.equal(isAccountId(123), false);
});
