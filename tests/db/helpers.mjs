// DBテスト共通の準備(メモリ上の空のPostgreSQL = PGlite を使う。実DBには接続しない)
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";

export const MIGRATIONS_DIR = join(import.meta.dirname, "../../supabase/migrations");

export function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
}

// PGliteにはpgcrypto拡張が無いため、テスト時のみ create extension 行を除く(gen_random_uuidは標準機能)
export function readMigration(file) {
  return readFileSync(join(MIGRATIONS_DIR, file), "utf8").replace(/^\s*create extension[^;]*;/gim, "");
}

// Supabaseと同じロールを用意し、指定した番号より前のマイグレーションを適用したDBを返す
export async function createTestDb({ before } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    grant usage on schema public to anon, authenticated, service_role;
  `);
  for (const file of migrationFiles().filter((f) => !before || f < before)) {
    await db.exec(readMigration(file));
  }
  return db;
}

export function helpers(db) {
  const rows = async (sql, params) => (await db.query(sql, params)).rows;
  const one = async (sql, params) => (await rows(sql, params))[0];
  const asService = async (sql, params) => {
    await db.exec("set role service_role");
    try {
      return await db.query(sql, params);
    } finally {
      await db.exec("reset role");
    }
  };
  return { rows, one, asService };
}

export async function expectError(promise, pattern) {
  try {
    await promise;
  } catch (e) {
    assert.match(e.message, pattern);
    return;
  }
  throw new Error(`エラーにならなかった(期待: ${pattern})`);
}

// ダミーのLINE User ID(実在しない)
export const lineUserId = (c) => "U" + c.repeat(32);
