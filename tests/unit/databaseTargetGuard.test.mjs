// 実行: npm test (node --test)。DBには接続しない純粋な関数のテスト。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PREVIEW_DB_NOT_ISOLATED,
  assertDatabaseTargetAllowed,
  isDatabaseTargetAllowed,
} from "../../src/lib/supabase/databaseTargetGuard.ts";

test("Production・ローカルでは目印が無くても接続できる", () => {
  assert.equal(isDatabaseTargetAllowed({ VERCEL_ENV: "production" }), true);
  assert.equal(isDatabaseTargetAllowed({}), true);
  assert.equal(isDatabaseTargetAllowed({ VERCEL_ENV: "development" }), true);
});

test("Preview は検証用DBの目印があるときだけ接続できる", () => {
  assert.equal(isDatabaseTargetAllowed({ VERCEL_ENV: "preview", NEXT_PUBLIC_CRM_DB_LABEL: "検証用DB" }), true);
  assert.equal(isDatabaseTargetAllowed({ VERCEL_ENV: "preview" }), false);
  assert.equal(isDatabaseTargetAllowed({ VERCEL_ENV: "preview", NEXT_PUBLIC_CRM_DB_LABEL: "  " }), false);
});

test("Preview で目印が無ければ接続前にエラーにする", () => {
  assert.throws(() => assertDatabaseTargetAllowed({ VERCEL_ENV: "preview" }), new RegExp(PREVIEW_DB_NOT_ISOLATED));
  assert.doesNotThrow(() => assertDatabaseTargetAllowed({ VERCEL_ENV: "production" }));
});
