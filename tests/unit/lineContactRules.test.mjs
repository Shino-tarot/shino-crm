// 実行: npm test (node --test)。DBには接続しない純粋な関数のテスト。
// src の .ts ファイルを Node.js の型除去機能(Node 22.18以降)でそのまま読み込む。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DISPLAY_NAME_FALLBACK,
  displayNameOrFallback,
  formatCustomerLabel,
  getLinkBlockReason,
  linkErrorMessageFromDbCode,
  normalizeSearchQuery,
  parseCustomerNo,
  toIlikePattern,
} from "../../src/lib/lineContacts/rules.ts";

// テスト用のダミーID(実在のLINEユーザーIDではない)
const LINE_A = "U" + "a".repeat(32);
const LINE_B = "U" + "b".repeat(32);
const base = {
  contactId: "contact-1",
  contactLineUserId: LINE_A,
  customerId: "customer-1",
  customerLineUserId: "",
  customerHidden: false,
  customerLinkedContactId: null,
  lineUserIdOwnerCustomerIds: [],
};

test("紐づけ可能: 顧客にLINE IDなし・他の紐づけなし", () => {
  assert.equal(getLinkBlockReason(base), null);
});

test("紐づけ可能: 顧客のLINE IDが一致(前後空白は無視)", () => {
  assert.equal(
    getLinkBlockReason({ ...base, customerLineUserId: ` ${LINE_A} `, lineUserIdOwnerCustomerIds: ["customer-1"] }),
    null,
  );
});

test("拒否: 顧客が既に別の送信者と紐づいている", () => {
  assert.equal(
    getLinkBlockReason({ ...base, customerLinkedContactId: "contact-2" }),
    "customer_already_linked",
  );
});

test("同じ送信者との紐づけは重複扱いしない", () => {
  assert.equal(getLinkBlockReason({ ...base, customerLinkedContactId: "contact-1" }), null);
});

test("拒否: 顧客に別のLINE IDが登録済み", () => {
  assert.equal(
    getLinkBlockReason({ ...base, customerLineUserId: LINE_B }),
    "customer_has_other_line_user_id",
  );
});

test("拒否: 送信者のLINE IDが別の顧客に登録済み", () => {
  assert.equal(
    getLinkBlockReason({ ...base, lineUserIdOwnerCustomerIds: ["customer-2"] }),
    "line_user_id_owned_by_other_customer",
  );
});

test("検索キーワードの整形", () => {
  assert.equal(normalizeSearchQuery("  鯛子 "), "鯛子");
  assert.equal(normalizeSearchQuery(""), null);
  assert.equal(normalizeSearchQuery("   "), null);
  assert.equal(normalizeSearchQuery("あ".repeat(51)), null);
  assert.equal(normalizeSearchQuery("あ".repeat(50)), "あ".repeat(50));
  assert.equal(normalizeSearchQuery(123), null);
  assert.equal(normalizeSearchQuery(undefined), null);
  assert.equal(normalizeSearchQuery("a\u0000b"), "ab");
});

test("ilikeパターンはワイルドカードをエスケープする", () => {
  assert.equal(toIlikePattern("abc"), "%abc%");
  assert.equal(toIlikePattern("50%_off\\"), "%50\\%\\_off\\\\%");
});

test("顧客番号の判定", () => {
  assert.equal(parseCustomerNo("12"), 12);
  assert.equal(parseCustomerNo("12a"), null);
  assert.equal(parseCustomerNo("1234567890"), null);
});

test("表示名が空なら「表示名未取得」", () => {
  assert.equal(displayNameOrFallback(""), DISPLAY_NAME_FALLBACK);
  assert.equal(displayNameOrFallback("  "), "表示名未取得");
  assert.equal(displayNameOrFallback(null), "表示名未取得");
  assert.equal(displayNameOrFallback("テスト"), "テスト");
});

test("顧客ラベル: 鑑定名→LINE名→本名の順", () => {
  const c = { customerNo: 3, readingName: "", lineName: "ライン", realName: "本名" };
  assert.equal(formatCustomerLabel(c), "No.3 ライン");
  assert.equal(formatCustomerLabel({ ...c, lineName: "", realName: "" }), "No.3 (名前未登録)");
});

test("DBエラーコードの変換", () => {
  assert.match(linkErrorMessageFromDbCode("23505"), /既に別のLINE送信者/);
  assert.match(linkErrorMessageFromDbCode("P0001"), /一致しない/);
  assert.match(linkErrorMessageFromDbCode("23503"), /見つかりません/);
  assert.match(linkErrorMessageFromDbCode(undefined), /失敗しました/);
});
