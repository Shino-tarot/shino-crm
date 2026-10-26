import "server-only";
import { supabaseServerClient } from "@/lib/supabase/server";

// Server Action("use server")ではなくサーバー内部専用のモジュール。
// "use server"ファイルからexportした関数は外部から直接呼び出せてしまうため、
// 公開フォーム(認可なし)と管理画面(要ログイン)の両方から使う顧客作成処理はここに置く。

export interface NewCustomerSeed {
  lineName: string;
  readingName: string;
  birthDate: string | null;
  gender: string | null;
  age: number | null;
}

// customersへ新しい顧客を1件作成するだけのヘルパー。
// 既存customersとの照合は一切行わない(呼び出し側の責務)。
export async function insertCustomer(seed: NewCustomerSeed): Promise<string> {
  const { data, error } = await supabaseServerClient
    .from("customers")
    .insert({
      line_name: seed.lineName,
      reading_name: seed.readingName,
      birthday: seed.birthDate,
      gender: seed.gender ?? "",
      age: seed.age,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

// 新規の無料鑑定申込(公開フォーム・ヒアリング手動登録)を保存する直前に顧客(customers)を
// 1件自動作成し、customer_idを紐付ける。既存customersへの自動統合は行わない(LINE表示名等による
// 誤マージ事故を避けるため、常に新規作成のみ)。万一顧客作成に失敗しても、本来の申込保存自体は
// 継続できるよう、customer_id=nullにフォールバックする(後からスタッフが手動で
// 「顧客として登録する」操作を行える)。
export async function createCustomerSafely(
  seed: NewCustomerSeed,
): Promise<string | null> {
  try {
    return await insertCustomer(seed);
  } catch (error) {
    console.error("[customers] auto create failed:", error);
    return null;
  }
}
