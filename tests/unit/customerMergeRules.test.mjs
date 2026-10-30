// 実行: npm test (node --test)。DBには接続しない純粋な関数のテスト。
// src の .ts ファイルを Node.js の型除去機能(Node 22.18以降)でそのまま読み込む。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getLineMergeState,
  getMergeBlockReason,
  mergeErrorMessageFromDb,
  willFillTargetLineUserId,
} from "../../src/lib/customers/mergeRules.ts";
import { canRestoreCustomer } from "../../src/lib/customers/visibility.ts";

// ダミーのLINE User ID(実在しない)
const A = "U" + "a".repeat(32);
const B = "U" + "b".repeat(32);
const empty = { hidden: false, lineUserId: "", linkedContactLineUserId: null };

test("統合可能: どちらもLINEなし", () => {
  assert.equal(getMergeBlockReason(empty, empty), null);
  assert.equal(getLineMergeState(empty, empty), "none");
});

test("統合可能: 統合元のLINE送信者を統合先へ移す(統合先のIDは空→埋める)", () => {
  const source = { hidden: false, lineUserId: A, linkedContactLineUserId: A };
  assert.equal(getMergeBlockReason(source, empty), null);
  assert.equal(getLineMergeState(source, empty), "move_from_source");
  assert.equal(willFillTargetLineUserId(source, empty), true);
});

test("統合可能: 統合先のLINE送信者を維持し、統合先のIDは上書きしない", () => {
  const target = { hidden: false, lineUserId: B, linkedContactLineUserId: B };
  assert.equal(getMergeBlockReason(empty, target), null);
  assert.equal(getLineMergeState(empty, target), "keep_target");
  assert.equal(willFillTargetLineUserId(empty, target), false);
  // 同じIDを持つ場合も上書きはしない
  assert.equal(willFillTargetLineUserId({ ...empty, lineUserId: B }, target), false);
});

test("拒否: 非表示の顧客", () => {
  assert.equal(getMergeBlockReason({ ...empty, hidden: true }, empty), "customer_hidden");
  assert.equal(getMergeBlockReason(empty, { ...empty, hidden: true }), "customer_hidden");
});

test("拒否: 両方にLINE送信者", () => {
  const source = { hidden: false, lineUserId: "", linkedContactLineUserId: A };
  const target = { hidden: false, lineUserId: "", linkedContactLineUserId: B };
  assert.equal(getMergeBlockReason(source, target), "line_both_linked");
  assert.equal(getLineMergeState(source, target), "conflict");
});

test("拒否: LINE User IDの食い違い(DB関数の4条件と同じ)", () => {
  assert.equal(getMergeBlockReason({ ...empty, lineUserId: A }, { ...empty, lineUserId: B }), "line_user_id_conflict");
  assert.equal(getMergeBlockReason({ ...empty, linkedContactLineUserId: A }, { ...empty, lineUserId: B }), "line_user_id_conflict");
  assert.equal(getMergeBlockReason({ ...empty, lineUserId: A }, { ...empty, linkedContactLineUserId: B }), "line_user_id_conflict");
  assert.equal(getMergeBlockReason({ ...empty, lineUserId: A, linkedContactLineUserId: B }, empty), "line_user_id_conflict");
  // 前後の空白は無視する
  assert.equal(getMergeBlockReason({ ...empty, lineUserId: ` ${A} ` }, { ...empty, lineUserId: A }), null);
});

test("DB関数のエラーコード → 画面のメッセージ", () => {
  assert.match(mergeErrorMessageFromDb("MERGE_LINE_BOTH_LINKED"), /別のLINE送信者/);
  assert.match(mergeErrorMessageFromDb("ERROR: MERGE_LINE_USER_ID_CONFLICT"), /一致しない/);
  assert.match(mergeErrorMessageFromDb("MERGE_CUSTOMER_HIDDEN"), /非表示/);
  assert.match(mergeErrorMessageFromDb("something else"), /データは変更されていません/);
  assert.match(mergeErrorMessageFromDb(undefined), /データは変更されていません/);
});

test("統合済みの顧客は復元できない", () => {
  assert.equal(canRestoreCustomer({ deletedAt: "2026-10-29T00:00:00Z", mergedIntoCustomerId: null }), true);
  assert.equal(canRestoreCustomer({ deletedAt: "2026-10-29T00:00:00Z", mergedIntoCustomerId: "x" }), false);
  assert.equal(canRestoreCustomer({ deletedAt: null, mergedIntoCustomerId: null }), false);
});

// ---------- 0018以降: アカウント・生年月日・根拠の強さ ----------
import {
  getBirthdayCheck,
  getMergeConfirmRequirements,
  getMergeEvidence,
  validateMergeConfirmation,
} from "../../src/lib/customers/mergeRules.ts";

const side = (overrides = {}) => ({
  accountId: "taiko", hidden: false, lineUserId: "", linkedContactLineUserId: null, birthday: null, ...overrides,
});

test("アカウントが違う顧客どうしは統合できない(他の条件より先に判定)", () => {
  assert.equal(getMergeBlockReason(side({ accountId: "taiko" }), side({ accountId: "yayoi" })), "cross_account");
  assert.equal(getMergeBlockReason(side({ accountId: "taiko", hidden: true }), side({ accountId: "yayoi" })), "cross_account");
  assert.equal(getMergeBlockReason(side(), side()), null);
  assert.match(mergeErrorMessageFromDb("MERGE_CROSS_ACCOUNT"), /アカウント/);
  assert.match(mergeErrorMessageFromDb("MERGE_BIRTHDAY_MISMATCH"), /生年月日/);
});

test("生年月日: 両方わかる場合のみ一致・不一致を判定", () => {
  assert.equal(getBirthdayCheck(side({ birthday: "1990-01-01" }), side({ birthday: "1990-01-01" })), "match");
  assert.equal(getBirthdayCheck(side({ birthday: "1990-01-01" }), side({ birthday: "1991-01-01" })), "mismatch");
  assert.equal(getBirthdayCheck(side({ birthday: "1990-01-01" }), side()), "unknown");
});

test("根拠: LINE User IDの一致のみ強い根拠(LINE表示名・名前は根拠にしない)", () => {
  assert.equal(getMergeEvidence(side({ linkedContactLineUserId: A }), side({ lineUserId: A })), "line_user_id_match");
  assert.equal(getMergeEvidence(side({ lineUserId: A }), side({ lineUserId: A })), "line_user_id_match");
  assert.equal(getMergeEvidence(side({ linkedContactLineUserId: A }), side()), "no_line_evidence");
  assert.equal(getMergeEvidence(side(), side()), "no_line_evidence");
});

test("確認操作: 根拠が弱いと照合チェック＋顧客番号、生年月日が違うと理由が必要", () => {
  assert.deepEqual(getMergeConfirmRequirements({ evidence: "line_user_id_match", birthdayCheck: "match", sourceHasCustomerNo: true }),
    { requireReason: false, requireIdentityCheck: false, requireSourceCustomerNo: false });
  assert.deepEqual(getMergeConfirmRequirements({ evidence: "no_line_evidence", birthdayCheck: "mismatch", sourceHasCustomerNo: true }),
    { requireReason: true, requireIdentityCheck: true, requireSourceCustomerNo: true });
  // 統合元が顧客未登録(顧客番号なし)なら番号の入力は求めない
  assert.equal(getMergeConfirmRequirements({ evidence: "no_line_evidence", birthdayCheck: "unknown", sourceHasCustomerNo: false }).requireSourceCustomerNo, false);
});

test("確認操作の入力チェック(サーバー側でも同じ判定を使う)", () => {
  const all = { requireReason: true, requireIdentityCheck: true, requireSourceCustomerNo: true };
  assert.match(validateMergeConfirmation(all, { reason: "ミス", identityChecked: true, typedSourceCustomerNo: "12" }, 12), /理由/);
  assert.match(validateMergeConfirmation(all, { reason: "本人に確認済み", identityChecked: false, typedSourceCustomerNo: "12" }, 12), /チェック/);
  assert.match(validateMergeConfirmation(all, { reason: "本人に確認済み", identityChecked: true, typedSourceCustomerNo: "13" }, 12), /顧客番号/);
  assert.equal(validateMergeConfirmation(all, { reason: "本人に確認済み", identityChecked: true, typedSourceCustomerNo: " 12 " }, 12), null);
  assert.match(validateMergeConfirmation(all, null, 12), /理由/);
  const none = { requireReason: false, requireIdentityCheck: false, requireSourceCustomerNo: false };
  assert.equal(validateMergeConfirmation(none, undefined, null), null);
});

test("申込と登録先の顧客の情報が食い違う場合は、LINE User IDが一致していても照合を求める", () => {
  const strong = getMergeConfirmRequirements({ evidence: "line_user_id_match", birthdayCheck: "match", sourceHasCustomerNo: true });
  assert.equal(strong.requireIdentityCheck, false);
  const withMismatch = getMergeConfirmRequirements({ evidence: "line_user_id_match", birthdayCheck: "match", sourceHasCustomerNo: true, requestMismatch: true });
  assert.equal(withMismatch.requireIdentityCheck, true);
  assert.equal(withMismatch.requireSourceCustomerNo, true);
});
