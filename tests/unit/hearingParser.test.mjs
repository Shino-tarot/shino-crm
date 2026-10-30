// 実行: npm test (node --test)。LINEヒアリング6項目のルール抽出(外部送信なし)のテスト。データはすべてダミー。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applySelectedHearingFields,
  normalizeDateString,
  parseHearingMessages,
  parseHearingText,
  planHearingApply,
} from "../../src/lib/freeReadingRequests/parseHearingText.ts";

const EMPTY = { name: "", birthDate: "", partnerName: "", partnerBirthDate: "", content: "", idealFuture: "" };

test("①〜⑥: 見出しの次の行に回答(新しい質問文)", () => {
  const r = parseHearingText(`①お名前
山田花子
②生年月日
1990/5/3
③お相手のお名前
田中太郎
④お相手の生年月日
1988年12月20日
⑤今、一番悩んでいること
彼と最近すれ違いが多くて
連絡も減っています
⑥今後どうなりたいか・叶えたい未来
円満に結婚したい`);
  assert.deepEqual(r.parsed, {
    name: "山田花子", birthDate: "1990-05-03", partnerName: "田中太郎", partnerBirthDate: "1988-12-20",
    content: "彼と最近すれ違いが多くて\n連絡も減っています", idealFuture: "円満に結婚したい",
  });
  assert.equal(r.matchedFields.length, 6);
});

test("見出しと回答が同じ行(項目名・（任意）・コロンを取り除く)", () => {
  const r = parseHearingText(`①お名前：山田花子
②生年月日：1990年5月3日
③お相手のお名前（任意）：田中太郎
⑤今、一番悩んでいること：仕事の人間関係
⑥今後どうなりたいか・叶えたい未来：転職して落ち着きたい`);
  assert.equal(r.parsed.name, "山田花子");
  assert.equal(r.parsed.partnerName, "田中太郎");
  assert.equal(r.parsed.content, "仕事の人間関係");
  assert.equal(r.parsed.idealFuture, "転職して落ち着きたい");
});

test("番号の書き方の違い: 1. / （１） / Q3 / 全角数字", () => {
  const r = parseHearingText(`1. お名前 山田花子
（２）生年月日 １９９０／５／３
Q5 悩み：仕事
６．理想：独立`);
  assert.equal(r.parsed.name, "山田花子");
  assert.equal(r.parsed.birthDate, "1990-05-03");
  assert.equal(r.parsed.content, "仕事");
  assert.equal(r.parsed.idealFuture, "独立");
});

test("複数のメッセージに分かれた回答をまとめて解析できる", () => {
  const r = parseHearingMessages(["①お名前", "山田花子", "②生年月日\n1990/5/3", "⑤今、一番悩んでいること", "仕事が", "つらいです", "⑥叶えたい未来\n楽になりたい"]);
  assert.equal(r.parsed.name, "山田花子");
  assert.equal(r.parsed.birthDate, "1990-05-03");
  assert.equal(r.parsed.content, "仕事が\nつらいです");
  assert.equal(r.parsed.idealFuture, "楽になりたい");
});

test("恋愛以外の相談: ③④が無い・「なし」でも正常(値は空のまま、補完しない)", () => {
  const r = parseHearingText(`①山田花子
②1990/5/3
③なし
④ー
⑤仕事の悩み
⑥転職したい`);
  assert.equal(r.parsed.partnerName, "");
  assert.equal(r.parsed.partnerBirthDate, "");
  assert.deepEqual(r.explicitlyEmptyFields, ["partnerName", "partnerBirthDate"]);
  assert.deepEqual(r.matchedFields, ["name", "birthDate", "content", "idealFuture"]);
  const r2 = parseHearingText("①山田花子\n②1990/5/3\n⑤仕事\n⑥転職");
  assert.equal(r2.parsed.partnerName, "");
  assert.ok(!r2.matchedFields.includes("partnerName"));
});

test("回答の中の箇条書き「1. 2.」や「5 年」を見出しと誤認しない", () => {
  const r = parseHearingText(`①山田花子
⑤今、一番悩んでいること
1. 仕事
2. 恋愛
5 年付き合っている彼のこと
⑥結婚したい`);
  assert.equal(r.parsed.name, "山田花子");
  assert.equal(r.parsed.content, "1. 仕事\n2. 恋愛\n5 年付き合っている彼のこと");
  assert.equal(r.parsed.idealFuture, "結婚したい");
});

test("番号なしの「項目名：回答」形式(お相手の名前を本人の名前と取り違えない)", () => {
  const r = parseHearingText(`お相手のお名前：田中太郎
お名前：山田花子
生年月日：平成2年5月3日
お悩み：仕事`);
  assert.equal(r.parsed.name, "山田花子");
  assert.equal(r.parsed.partnerName, "田中太郎");
  assert.equal(r.parsed.birthDate, "1990-05-03");
  assert.equal(r.parsed.content, "仕事");
});

test("番号も項目名も無い自由文は推測で振り分けない(未判定)", () => {
  const r = parseHearingText("山田花子です。1990年5月3日生まれです。仕事のことで悩んでいます。");
  assert.deepEqual(r.matchedFields, []);
  assert.deepEqual(r.parsed, EMPTY);
  // 「名前は〜」のような文章も項目名の行とはみなさない
  assert.deepEqual(parseHearingText("名前は山田です").matchedFields, []);
});

test("LINEのトーク履歴をコピーした形式(日付行・時刻・送信者)を取り除く", () => {
  const r = parseHearingText("2026/10/29(水)\n12:34\tテスト\t①お名前\n12:35\tテスト\t山田花子\n12:36\tテスト\t⑤悩み：仕事");
  assert.equal(r.parsed.name, "山田花子");
  assert.equal(r.parsed.content, "仕事");
});

test("生年月日の形式", () => {
  assert.equal(normalizeDateString("1990年5月3日"), "1990-05-03");
  assert.equal(normalizeDateString("1990-05-03"), "1990-05-03");
  assert.equal(normalizeDateString("1990.5.3"), "1990-05-03");
  assert.equal(normalizeDateString("19900503"), "1990-05-03");
  assert.equal(normalizeDateString("平成2年5月3日"), "1990-05-03");
  assert.equal(normalizeDateString("令和元年5月1日"), "2019-05-01");
  assert.equal(normalizeDateString("昭和63年1月1日"), "1988-01-01");
  assert.equal(normalizeDateString("１９９０年５月３日"), "1990-05-03");
  // 存在しない日付・読めない値は空(推測で補わない)
  assert.equal(normalizeDateString("1990/2/30"), "");
  assert.equal(normalizeDateString("5月3日"), "");
  assert.equal(normalizeDateString("平成2年頃"), "");
  const r = parseHearingText("①山田花子\n②5月3日生まれ");
  assert.deepEqual(r.unparsedDateFields, ["birthDate"]);
  assert.equal(r.parsed.birthDate, "");
});

test("取り込みの確認: 空欄は反映候補、入力済みと違う値は上書きしない(選んだ場合のみ)", () => {
  const result = parseHearingText("①山田花子\n②1990/5/3\n⑤仕事");
  const current = { ...EMPTY, name: "山田", birthDate: "1990-05-03" };
  const plan = planHearingApply(current, result);
  assert.deepEqual(plan.map((e) => [e.field, e.action]), [["name", "conflict"], ["birthDate", "same"], ["content", "fill"]]);
  // 初期選択(空欄の項目のみ)では名前は変わらない
  assert.deepEqual(applySelectedHearingFields(plan, new Set(["content"])), { content: "仕事" });
  // 明示的に選んだ場合のみ上書き。「同じ」は選んでも変更なし
  assert.deepEqual(applySelectedHearingFields(plan, new Set(["name", "birthDate", "content"])), { name: "山田花子", content: "仕事" });
});

test("見出しの行の質問文は回答に含めず、回答の書き出しは次の行の続きとつなげる", () => {
  const r = parseHearingText(`①お名前を教えてください
山田花子
⑤今、一番悩んでいることは何ですか？
仕事のこと
⑥結婚して
穏やかに暮らしたい`);
  assert.equal(r.parsed.name, "山田花子");
  assert.equal(r.parsed.content, "仕事のこと");
  assert.equal(r.parsed.idealFuture, "結婚して\n穏やかに暮らしたい");
});
