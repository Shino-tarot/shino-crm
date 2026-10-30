// 実行: npm test (node --test)。フォロー通知のアカウント分離(純粋な関数)のテスト。データはダミー。
import { test } from "node:test";
import assert from "node:assert/strict";
import { partitionFollowUpsByAccount } from "../../src/lib/followUp/rules.ts";

const launchedAt = "2026-10-01T00:00:00.000Z";
const now = new Date("2026-10-29T12:00:00.000Z");
const row = (id, account_id, overrides = {}) => ({
  id, account_id, status: "free_reading_sent", sent_at: "2026-10-27T00:00:00.000Z",
  detail_request: null, followed_up_at: null, customer_hidden: false, ...overrides,
});

test("表示中のアカウントの通知だけを返し、他のアカウントは新規の件数だけを数える", () => {
  const result = partitionFollowUpsByAccount(
    [
      row("t1", "taiko"),
      row("t2", "taiko", { sent_at: "2026-09-01T00:00:00.000Z" }), // 導入前に24時間経過 → 過去分
      row("y1", "yayoi"),
      row("y2", "yayoi"),
      row("y3", "yayoi", { sent_at: "2026-09-01T00:00:00.000Z" }), // 他アカウントの過去分は数えない
    ],
    "taiko",
    launchedAt,
    now,
  );
  assert.deepEqual(result.newRows.map((r) => r.id), ["t1"]);
  assert.deepEqual(result.pastRows.map((r) => r.id), ["t2"]);
  assert.deepEqual([...result.otherAccountNewCounts], [["yayoi", 2]]);
});

test("夜宵を表示中なら鯛子の申込は件数のみ。対象外(非表示・フォロー済み・回答済み)は数えない", () => {
  const result = partitionFollowUpsByAccount(
    [
      row("t1", "taiko"),
      row("t2", "taiko", { customer_hidden: true }),
      row("t3", "taiko", { followed_up_at: "2026-10-28T00:00:00.000Z" }),
      row("t4", "taiko", { detail_request: "yes" }),
      row("y1", "yayoi", { status: "archived" }),
    ],
    "yayoi",
    launchedAt,
    now,
  );
  assert.equal(result.newRows.length, 0);
  assert.equal(result.pastRows.length, 0);
  assert.deepEqual([...result.otherAccountNewCounts], [["taiko", 1]]);
});
