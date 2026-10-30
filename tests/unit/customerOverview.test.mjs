// 実行: npm test (node --test)。DBには接続しない純粋な関数のテスト。
import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeCustomerOverviews } from "../../src/lib/customers/overviewRules.ts";

test("顧客ごとの最新ステータス・最終申込日・件数・LINE連携", () => {
  const result = summarizeCustomerOverviews(
    [
      { customer_id: "a", status: "new", application_date: "2026-10-01", created_at: "2026-10-01T00:00:00Z" },
      { customer_id: "a", status: "free_reading_sent", application_date: "2026-10-20", created_at: "2026-10-02T00:00:00Z" },
      { customer_id: "b", status: "contacted", application_date: null, created_at: "2026-09-05T00:00:00Z" },
    ],
    ["b", "c"],
  );
  assert.deepEqual(result.a, { latestStatus: "free_reading_sent", lastApplicationDate: "2026-10-20", requestCount: 2, lineLinked: false });
  assert.deepEqual(result.b, { latestStatus: "contacted", lastApplicationDate: "2026-09-05T00:00:00Z", requestCount: 1, lineLinked: true });
  // 申込なし・LINE連携のみの顧客
  assert.deepEqual(result.c, { latestStatus: null, lastApplicationDate: null, requestCount: 0, lineLinked: true });
});

test("同じ申込日なら登録日時が新しい申込を最新とする", () => {
  const result = summarizeCustomerOverviews(
    [
      { customer_id: "a", status: "new", application_date: "2026-10-01", created_at: "2026-10-01T09:00:00Z" },
      { customer_id: "a", status: "archived", application_date: "2026-10-01", created_at: "2026-10-01T10:00:00Z" },
    ],
    [],
  );
  assert.equal(result.a.latestStatus, "archived");
});
