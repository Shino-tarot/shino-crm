import "server-only";
import { supabaseServerClient } from "@/lib/supabase/server";

// 送信日時が未来の有料鑑定を持つ顧客ID(「送信予約中」バッジの表示判定用)。
// 失敗しても一覧表示は止めず、バッジを出さないだけにする。
export async function listScheduledPaidReadingCustomerIds(): Promise<Set<string>> {
  const { data, error } = await supabaseServerClient
    .from("paid_readings")
    .select("customer_id")
    .is("deleted_at", null)
    .gt("sent_at", new Date().toISOString());
  if (error) {
    console.error("[scheduled-send] paid_readings fetch failed:", error.message);
    return new Set();
  }
  return new Set(data.map((row) => row.customer_id as string));
}
