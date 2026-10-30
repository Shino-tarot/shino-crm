// 実行: npm test (node --test)。申込と顧客の対応の判定(純粋な関数)のテスト。データはダミー。
import { test } from "node:test";
import assert from "node:assert/strict";
import { isSameLineName, requestCustomerMismatch } from "../../src/lib/freeReadingRequests/customerLink.ts";

test("同じLINE表示名の候補は完全一致のみ(前後空白・大文字小文字は無視)", () => {
  assert.equal(isSameLineName("【テスト】統合確認B", "【テスト】統合確認B"), true);
  assert.equal(isSameLineName(" ABC ", "abc"), true);
  assert.equal(isSameLineName("【テスト】統合確認", "【テスト】統合確認B"), false);
  assert.equal(isSameLineName("【テスト】統合確認B", "【テスト】統合確認"), false);
  assert.equal(isSameLineName("", ""), false);
  assert.equal(isSameLineName(null, "a"), false);
});

test("申込の名前・生年月日と、登録先の顧客の食い違い(No.12「テスト」に別の名前の申込が付いた場合など)", () => {
  assert.deepEqual(
    requestCustomerMismatch({ name: "統合元テストB", birthDate: "1995-04-01" }, { readingName: "テスト", birthday: "1990-02-03" }),
    ["name", "birthday"],
  );
  assert.deepEqual(requestCustomerMismatch({ name: "山田", birthDate: "1995-04-01" }, { readingName: " 山田 ", birthday: "1995-04-01" }), []);
  // 片方が空なら比べない
  assert.deepEqual(requestCustomerMismatch({ name: "", birthDate: null }, { readingName: "テスト", birthday: "1990-02-03" }), []);
});
