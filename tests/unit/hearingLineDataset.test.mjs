// 実行: npm test (node --test)。実際のLINEのやり取りに近いテスト用データ(すべて架空)で、6項目の抽出を確かめる。
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHearingMessages, parseHearingText, planHearingApply, applySelectedHearingFields } from "../../src/lib/freeReadingRequests/parseHearingText.ts";

// LINEのトーク履歴(PC版のテキスト保存に近い形式)。鯛子の質問テンプレート → お客様の回答(途中に鯛子の返信)
const CHAT_EXPORT = [
  "2026/10/29(水)",
  "10:00\t鯛子\t\"無料鑑定のご希望ありがとうございます。以下にお答えください。",
  "①お名前",
  "②生年月日",
  "③お相手のお名前",
  "④お相手の生年月日",
  "⑤今、一番悩んでいること",
  "⑥今後どうなりたいか・叶えたい未来\"",
  "10:05\tテスト花子\t\"①テスト花子",
  "②1992年7月7日\"",
  "10:06\t鯛子\tありがとうございます。続きもお願いします。",
  "10:08\tテスト花子\t\"③テスト太郎",
  "④平成元年3月3日\"",
  "10:10\tテスト花子\t\"⑤彼からの連絡が減っていて不安です",
  "このまま続けていいのか迷っています\"",
  "10:11\t鯛子\t承知しました。",
  "10:12\tテスト花子\t⑥安心できる関係になりたい",
].join("\n");

test("トーク履歴全体: 質問テンプレートと鯛子の返信を除き、お客様の回答だけを抽出", () => {
  const r = parseHearingText(CHAT_EXPORT);
  assert.deepEqual(r.parsed, {
    name: "テスト花子",
    birthDate: "1992-07-07",
    partnerName: "テスト太郎",
    partnerBirthDate: "1989-03-03",
    content: "彼からの連絡が減っていて不安です\nこのまま続けていいのか迷っています",
    idealFuture: "安心できる関係になりたい",
  });
  assert.ok(!r.parsed.content.includes("承知しました"));
});

test("会話履歴から選んだ受信メッセージ(複数)をまとめて解析", () => {
  const r = parseHearingMessages([
    "①テスト花子\n②1992/7/7",
    "③なし\n④なし",
    "⑤仕事の人間関係で悩んでいます",
    "⑥職場で自分らしく働けるようになりたい",
  ]);
  assert.equal(r.parsed.name, "テスト花子");
  assert.equal(r.parsed.birthDate, "1992-07-07");
  // 恋愛以外の相談: お相手は空欄のまま(補完しない)
  assert.equal(r.parsed.partnerName, "");
  assert.equal(r.parsed.partnerBirthDate, "");
  assert.deepEqual(r.explicitlyEmptyFields, ["partnerName", "partnerBirthDate"]);
  assert.equal(r.parsed.content, "仕事の人間関係で悩んでいます");
});

test("夜宵のお客様の回答(番号の書き方が違う)も同じように抽出", () => {
  const r = parseHearingText("1. テスト夜子\n2. 1988.12.24\n5. 金運のこと\n6. 貯金を増やしたい");
  assert.deepEqual(
    [r.parsed.name, r.parsed.birthDate, r.parsed.content, r.parsed.idealFuture],
    ["テスト夜子", "1988-12-24", "金運のこと", "貯金を増やしたい"],
  );
  assert.equal(r.parsed.partnerName, "");
});

test("確認前は何も更新しない: 解析結果は確認画面の候補にすぎず、選んだ項目だけが反映される", () => {
  const result = parseHearingText(CHAT_EXPORT);
  // 既に入力済み(顧客情報から初期値が入っている等)の名前・生年月日と違っても、初期選択には含めない
  const current = { name: "テスト花子(登録名)", birthDate: "1992-07-07", partnerName: "", partnerBirthDate: "", content: "", idealFuture: "" };
  const plan = planHearingApply(current, result);
  const initiallySelected = new Set(plan.filter((e) => e.action === "fill").map((e) => e.field));
  const applied = applySelectedHearingFields(plan, initiallySelected);
  assert.equal("name" in applied, false); // 入力済みの名前は上書きしない
  assert.equal("birthDate" in applied, false); // 同じ値は変更なし
  assert.deepEqual(Object.keys(applied).sort(), ["content", "idealFuture", "partnerBirthDate", "partnerName"]);
});
